const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const googleMapsService = require("./googleMaps.service");
const { deletePattern } = require("../../utils/cache");
const {
  bookingUsesSelfDropOff,
} = require("../../constants/serviceFulfillmentType");

const TRACKABLE_STATUSES = new Set([
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
]);
const ROUTE_MOVEMENT_REFRESH_METERS = 40;

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const getDistanceMeters = (origin, destination) => {
  const latitude1 = Number(origin?.latitude);
  const longitude1 = Number(origin?.longitude);
  const latitude2 = Number(destination?.latitude);
  const longitude2 = Number(destination?.longitude);

  if (![latitude1, longitude1, latitude2, longitude2].every(Number.isFinite)) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
};

const hasUsableRoute = (route) =>
  Number(route?.distanceMeters) > 0 &&
  Number(route?.durationSeconds) > 0 &&
  Boolean(String(route?.encodedPolyline || "").trim());

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
      services: {
        include: {
          service: { select: { fulfillmentType: true } },
        },
      },
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

  if (
    account.role === "GARAGE_CONTROLLER" &&
    booking.garageControllerId === account.id
  ) {
    return;
  }

  throw new ApiError(403, "You cannot view tracking for this booking");
};

const resolveTrackingActor = async (account, booking, workerTask = null) => {
  if (workerTask) {
    const activeStatuses = new Set(["ACTIVE", "IN_PROGRESS"]);
    if (
      workerTask.bookingId !== booking.id ||
      workerTask.garageId !== booking.garageId ||
      !activeStatuses.has(workerTask.status) ||
      workerTask.revokedAt ||
      new Date(workerTask.expiresAt).getTime() <= Date.now()
    ) {
      throw new ApiError(403, "This worker task cannot share location for the booking");
    }

    return {
      source: "GARAGE",
      garageId: workerTask.garageId,
      userId: null,
      garageControllerId: null,
      garageOwnerId: null,
      workerTaskId: workerTask.id,
    };
  }

  if (!account) {
    throw new ApiError(401, "Authentication is required");
  }

  if (account.accountType === "STAFF") {
    return {
      source: "ADMIN",
      garageId: booking.garageId,
      userId: null,
      garageOwnerId: null,
      garageControllerId: null,
      workerTaskId: null,
    };
  }

  if (!["GARAGE_OWNER", "GARAGE_CONTROLLER"].includes(account.role)) {
    throw new ApiError(403, "Only the assigned garage can share live location");
  }

  const garage =
    account.role === "GARAGE_CONTROLLER"
      ? await prisma.garage.findUnique({ where: { id: account.garageId } })
      : await getGarageForOwner(account.id);
  if (!booking.garageId || booking.garageId !== garage.id) {
    throw new ApiError(403, "This booking is not assigned to your garage");
  }
  if (
    account.role === "GARAGE_CONTROLLER" &&
    booking.garageControllerId !== account.id
  ) {
    throw new ApiError(403, "This active booking belongs to another controller");
  }

  return {
    source: "GARAGE",
    garageId: garage.id,
    userId: null,
    garageControllerId:
      account.role === "GARAGE_CONTROLLER" ? account.id : null,
    garageOwnerId: account.role === "GARAGE_OWNER" ? account.id : null,
    workerTaskId: null,
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
    Number(process.env.GOOGLE_TRACKING_ROUTE_REFRESH_SECONDS || 30),
  );
  const cachedRoute = {
    distanceMeters: booking.routeDistanceMeters,
    durationSeconds: booking.routeDurationSeconds,
    encodedPolyline: booking.routePolyline,
  };
  const movedMeters = getDistanceMeters(
    {
      latitude: booking.lastGarageLatitude,
      longitude: booking.lastGarageLongitude,
    },
    currentLocation,
  );
  const stale =
    !booking.routeUpdatedAt ||
    Date.now() - new Date(booking.routeUpdatedAt).getTime() >=
      refreshSeconds * 1000 ||
    (Number.isFinite(movedMeters) &&
      movedMeters >= ROUTE_MOVEMENT_REFRESH_METERS);

  if (!stale) {
    return hasUsableRoute(cachedRoute) ? cachedRoute : null;
  }

  const destination = {
    latitude: booking.customerLatitude,
    longitude: booking.customerLongitude,
  };
  const trafficAware = process.env.GOOGLE_TRAFFIC_AWARE !== "false";

  try {
    const route = await googleMapsService.computeRoute({
      origin: currentLocation,
      destination,
      trafficAware,
    });

    if (hasUsableRoute(route)) return route;
    throw new Error("Google Maps returned an incomplete driving route");
  } catch (error) {
    if (trafficAware) {
      try {
        const fallbackRoute = await googleMapsService.computeRoute({
          origin: currentLocation,
          destination,
          trafficAware: false,
        });
        if (hasUsableRoute(fallbackRoute)) return fallbackRoute;
      } catch (fallbackError) {
        console.warn(
          "[tracking] traffic-unaware route refresh skipped:",
          fallbackError.message,
        );
      }
    }

    console.warn("[tracking] route refresh skipped:", error.message);
    return hasUsableRoute(cachedRoute) ? cachedRoute : null;
  }
};

const assertLiveTrackingEnabledForBooking = (booking) => {
  if (bookingUsesSelfDropOff(booking)) {
    throw new ApiError(
      409,
      "Live pickup tracking is not used for self drop-off bookings",
    );
  }
};

const startTracking = async ({ bookingId, account, workerTask = null }) => {
  const booking = await loadBooking(bookingId);
  await resolveTrackingActor(account, booking, workerTask);
  assertLiveTrackingEnabledForBooking(booking);

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

const addTrackingPoint = async ({ bookingId, account, workerTask = null, data }) => {
  const booking = await loadBooking(bookingId);
  const actor = await resolveTrackingActor(account, booking, workerTask);
  assertLiveTrackingEnabledForBooking(booking);

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
      const latestOriginalIndex = recentPoints.length;
      snapped =
        snappedPoints.find(
          (point) => point.originalIndex === latestOriginalIndex,
        ) || null;
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
        garageOwnerId: actor.garageOwnerId,
        garageControllerId: actor.garageControllerId,
        workerTaskId: actor.workerTaskId,
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
        // Preserve the actual garage GPS fix for the live marker and arrival
        // distance. Road-snapped coordinates are used only for route/trail
        // calculation so the displayed garage position is never replaced by
        // an older or shifted road point.
        lastGarageLatitude: rawLocation.latitude,
        lastGarageLongitude: rawLocation.longitude,
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
        // Also record a failed route-attempt timestamp so a provider outage
        // cannot trigger two route calls for every incoming GPS sample.
        routeUpdatedAt: new Date(),
        ...(route && {
          routeDistanceMeters: route.distanceMeters,
          routeDurationSeconds: route.durationSeconds,
          routePolyline: route.encodedPolyline,
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

const stopTracking = async ({ bookingId, account, workerTask = null }) => {
  const booking = await loadBooking(bookingId);
  await resolveTrackingActor(account, booking, workerTask);
  assertLiveTrackingEnabledForBooking(booking);

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
  assertLiveTrackingEnabledForBooking(booking);

  const points = await prisma.bookingTrackingPoint.findMany({
    where: { bookingId },
    include: {
      workerTask: {
        select: { id: true, workerName: true, taskType: true },
      },
    },
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
      workerTask: point.workerTask,
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
