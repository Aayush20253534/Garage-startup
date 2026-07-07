const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const googleMapsService = require("./googleMaps.service");
const { deletePattern } = require("../../utils/cache");

const TRACKABLE_STATUSES = new Set([
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
]);

const getGarageForOwner = async (userId) => {
  const garage = await prisma.garage.findFirst({
    where: { ownerId: userId, isActive: true },
    select: { id: true, name: true, latitude: true, longitude: true },
  });
  if (!garage) throw new ApiError(404, "Garage profile not found");
  return garage;
};

const loadBooking = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      garage: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          phone: true,
          latitude: true,
          longitude: true,
        },
      },
      vehicle: true,
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

const assertCanView = async (account, booking) => {
  if (account.accountType === "STAFF") return;

  if (account.role === "CUSTOMER" && booking.userId === account.id) return;

  if (
    account.role === "GARAGE_OWNER" &&
    booking.garage?.ownerId === account.id
  ) {
    return;
  }

  throw new ApiError(403, "You cannot view tracking for this booking");
};

const resolveTrackingActor = async (account, booking) => {
  if (account.accountType === "STAFF") {
    return {
      source: "ADMIN",
      garageId: booking.garageId,
      userId: null,
    };
  }

  if (account.role !== "GARAGE_OWNER") {
    throw new ApiError(403, "Only the assigned garage can share live location");
  }

  const garage = await getGarageForOwner(account.id);
  if (!booking.garageId || booking.garageId !== garage.id) {
    throw new ApiError(403, "This booking is not assigned to your garage");
  }

  return {
    source: "GARAGE",
    garageId: garage.id,
    userId: account.id,
  };
};

const refreshRouteIfNeeded = async (booking, currentLocation) => {
  if (
    booking.customerLatitude === null ||
    booking.customerLongitude === null
  ) {
    return null;
  }

  const refreshSeconds = Math.max(
    30,
    Number(process.env.GOOGLE_TRACKING_ROUTE_REFRESH_SECONDS || 60),
  );
  const stale =
    !booking.routeUpdatedAt ||
    Date.now() - new Date(booking.routeUpdatedAt).getTime() >= refreshSeconds * 1000;

  if (!stale) {
    return {
      distanceMeters: booking.routeDistanceMeters,
      durationSeconds: booking.routeDurationSeconds,
      encodedPolyline: booking.routePolyline,
    };
  }

  try {
    return await googleMapsService.computeRoute({
      origin: currentLocation,
      destination: {
        latitude: booking.customerLatitude,
        longitude: booking.customerLongitude,
      },
      trafficAware: process.env.GOOGLE_TRAFFIC_AWARE !== "false",
    });
  } catch (error) {
    console.warn("[tracking] route refresh skipped:", error.message);
    return null;
  }
};

const startTracking = async ({ bookingId, account }) => {
  const booking = await loadBooking(bookingId);
  await resolveTrackingActor(account, booking);

  if (!TRACKABLE_STATUSES.has(booking.status)) {
    throw new ApiError(409, "Live tracking is not available for this booking status");
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      trackingStartedAt: booking.trackingStartedAt || new Date(),
      trackingEndedAt: null,
    },
    select: {
      id: true,
      trackingStartedAt: true,
      trackingEndedAt: true,
    },
  });
};

const addTrackingPoint = async ({ bookingId, account, data }) => {
  const booking = await loadBooking(bookingId);
  const actor = await resolveTrackingActor(account, booking);

  if (!TRACKABLE_STATUSES.has(booking.status)) {
    throw new ApiError(409, "Live tracking is not available for this booking status");
  }

  const rawLocation = googleMapsService.normalizeCoordinate(
    data,
    "live tracking",
  );

  const recentPoints = await prisma.bookingTrackingPoint.findMany({
    where: { bookingId },
    select: { latitude: true, longitude: true },
    orderBy: { recordedAt: "desc" },
    take: 15,
  });

  let snapped = null;
  if (process.env.GOOGLE_ROADS_ENABLED !== "false") {
    try {
      const snappedPoints = await googleMapsService.snapToRoads({
        points: [
          ...recentPoints.reverse(),
          rawLocation,
        ],
        interpolate: false,
      });
      snapped = snappedPoints.at(-1) || null;
    } catch (error) {
      console.warn("[tracking] roads snap skipped:", error.message);
    }
  }

  const effectiveLocation = snapped?.location || rawLocation;
  const route = await refreshRouteIfNeeded(booking, effectiveLocation);
  const recordedAt = data.recordedAt ? new Date(data.recordedAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const point = await tx.bookingTrackingPoint.create({
      data: {
        bookingId,
        garageId: actor.garageId,
        userId: actor.userId,
        source: actor.source,
        latitude: rawLocation.latitude,
        longitude: rawLocation.longitude,
        snappedLatitude: snapped?.location?.latitude ?? null,
        snappedLongitude: snapped?.location?.longitude ?? null,
        roadPlaceId: snapped?.placeId || null,
        heading:
          data.heading === null || data.heading === undefined
            ? null
            : Number(data.heading),
        speedKph:
          data.speedKph === null || data.speedKph === undefined
            ? null
            : Number(data.speedKph),
        accuracyM:
          data.accuracyM === null || data.accuracyM === undefined
            ? null
            : Number(data.accuracyM),
        recordedAt,
      },
    });

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        trackingStartedAt: booking.trackingStartedAt || new Date(),
        trackingEndedAt: null,
        lastGarageLatitude: effectiveLocation.latitude,
        lastGarageLongitude: effectiveLocation.longitude,
        lastGarageHeading:
          data.heading === null || data.heading === undefined
            ? null
            : Number(data.heading),
        lastGarageSpeedKph:
          data.speedKph === null || data.speedKph === undefined
            ? null
            : Number(data.speedKph),
        lastGarageAccuracyM:
          data.accuracyM === null || data.accuracyM === undefined
            ? null
            : Number(data.accuracyM),
        lastGarageLocationAt: recordedAt,
        ...(route && {
          routeDistanceMeters: route.distanceMeters,
          routeDurationSeconds: route.durationSeconds,
          routePolyline: route.encodedPolyline,
          routeUpdatedAt: new Date(),
        }),
      },
      select: {
        routeDistanceMeters: true,
        routeDurationSeconds: true,
        routePolyline: true,
        routeUpdatedAt: true,
      },
    });

    return { point, route: updatedBooking };
  });

  await Promise.allSettled([
    deletePattern(`customer:${booking.userId}:booking:${bookingId}*`),
    deletePattern(`customer:${booking.userId}:bookings:*`),
  ]);

  return {
    ...result,
    effectiveLocation,
  };
};

const stopTracking = async ({ bookingId, account }) => {
  const booking = await loadBooking(bookingId);
  await resolveTrackingActor(account, booking);

  return prisma.booking.update({
    where: { id: bookingId },
    data: { trackingEndedAt: new Date() },
    select: {
      id: true,
      trackingStartedAt: true,
      trackingEndedAt: true,
    },
  });
};

const getTracking = async ({ bookingId, account }) => {
  const booking = await loadBooking(bookingId);
  await assertCanView(account, booking);

  const points = await prisma.bookingTrackingPoint.findMany({
    where: { bookingId },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });

  return {
    bookingId: booking.id,
    status: booking.status,
    trackingActive: Boolean(
      booking.trackingStartedAt && !booking.trackingEndedAt,
    ),
    trackingStartedAt: booking.trackingStartedAt,
    trackingEndedAt: booking.trackingEndedAt,
    latestLocation:
      booking.lastGarageLatitude !== null &&
      booking.lastGarageLongitude !== null
        ? {
            latitude: booking.lastGarageLatitude,
            longitude: booking.lastGarageLongitude,
            heading: booking.lastGarageHeading,
            speedKph: booking.lastGarageSpeedKph,
            accuracyM: booking.lastGarageAccuracyM,
            recordedAt: booking.lastGarageLocationAt,
          }
        : null,
    customerLocation:
      booking.customerLatitude !== null &&
      booking.customerLongitude !== null
        ? {
            latitude: booking.customerLatitude,
            longitude: booking.customerLongitude,
            address: booking.customerAddress,
          }
        : null,
    garage: booking.garage,
    vehicle: booking.vehicle,
    route: {
      distanceMeters: booking.routeDistanceMeters,
      durationSeconds: booking.routeDurationSeconds,
      encodedPolyline: booking.routePolyline,
      updatedAt: booking.routeUpdatedAt,
    },
    points: points.reverse().map((point) => ({
      id: point.id,
      latitude: point.snappedLatitude ?? point.latitude,
      longitude: point.snappedLongitude ?? point.longitude,
      rawLatitude: point.latitude,
      rawLongitude: point.longitude,
      heading: point.heading,
      speedKph: point.speedKph,
      accuracyM: point.accuracyM,
      roadPlaceId: point.roadPlaceId,
      recordedAt: point.recordedAt,
    })),
  };
};

module.exports = {
  addTrackingPoint,
  getTracking,
  startTracking,
  stopTracking,
};
