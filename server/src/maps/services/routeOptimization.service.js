const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const googleMapsService = require("./googleMaps.service");

const ACTIVE_ROUTE_STATUSES = [
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const toTimestamp = (date) => new Date(date).toISOString();

const optimizeActiveBookings = async ({ bookingIds = [] } = {}) => {
  const where = {
    status: { in: ACTIVE_ROUTE_STATUSES },
    garageId: { not: null },
    customerLatitude: { not: null },
    customerLongitude: { not: null },
    ...(bookingIds.length ? { id: { in: bookingIds } } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      garage: true,
      user: { select: { id: true, name: true, phone: true } },
      vehicle: true,
      services: { include: { service: true } },
    },
    orderBy: [{ garageId: "asc" }, { scheduledDate: "asc" }, { createdAt: "asc" }],
    take: 100,
  });

  if (!bookings.length) {
    throw new ApiError(404, "No assigned bookings are available for route optimization");
  }

  const garages = [...new Map(
    bookings
      .filter((booking) => booking.garage)
      .map((booking) => [booking.garage.id, booking.garage]),
  ).values()];

  if (!garages.length) {
    throw new ApiError(400, "Assigned garages are missing location data");
  }

  const vehicleIndexByGarageId = new Map(
    garages.map((garage, index) => [garage.id, index]),
  );

  const now = new Date();
  const end = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const model = {
    globalStartTime: toTimestamp(now),
    globalEndTime: toTimestamp(end),
    vehicles: garages.map((garage) => ({
      label: garage.id,
      startLocation: {
        latitude: garage.latitude,
        longitude: garage.longitude,
      },
      endLocation: {
        latitude: garage.latitude,
        longitude: garage.longitude,
      },
      startTimeWindows: [
        { startTime: toTimestamp(now), endTime: toTimestamp(end) },
      ],
      endTimeWindows: [
        { startTime: toTimestamp(now), endTime: toTimestamp(end) },
      ],
      costPerKilometer: 1,
      costPerHour: 1,
    })),
    shipments: bookings.map((booking) => ({
      label: booking.id,
      allowedVehicleIndices: [vehicleIndexByGarageId.get(booking.garageId)],
      deliveries: [
        {
          arrivalLocation: {
            latitude: booking.customerLatitude,
            longitude: booking.customerLongitude,
          },
          duration: `${Math.max(300, Number(process.env.GOOGLE_OPTIMIZATION_STOP_SECONDS || 600))}s`,
          label: booking.bookingCode,
        },
      ],
      penaltyCost: 100000,
    })),
  };

  const response = await googleMapsService.optimizeTours({
    model,
    timeout: process.env.GOOGLE_OPTIMIZATION_TIMEOUT || "20s",
    label: `rovauto-${Date.now()}`,
  });

  const bookingByIndex = new Map(bookings.map((booking, index) => [index, booking]));

  return {
    generatedAt: new Date(),
    routes: (response.routes || []).map((route) => {
      const garage = garages[route.vehicleIndex];
      return {
        garage: garage
          ? {
              id: garage.id,
              name: garage.name,
              latitude: garage.latitude,
              longitude: garage.longitude,
            }
          : null,
        vehicleIndex: route.vehicleIndex,
        vehicleLabel: route.vehicleLabel,
        startTime: route.vehicleStartTime,
        endTime: route.vehicleEndTime,
        routeTotalCost: route.routeTotalCost,
        metrics: route.metrics || null,
        routePolyline: route.routePolyline?.points || null,
        visits: (route.visits || []).map((visit, order) => {
          const booking = bookingByIndex.get(visit.shipmentIndex);
          return {
            order: order + 1,
            bookingId: booking?.id || null,
            bookingCode: booking?.bookingCode || visit.shipmentLabel || null,
            customerName: booking?.user?.name || "Customer",
            customerPhone: booking?.user?.phone || null,
            customerAddress: booking?.customerAddress || null,
            latitude: booking?.customerLatitude || null,
            longitude: booking?.customerLongitude || null,
            vehicle: booking?.vehicle || null,
            startTime: visit.startTime || null,
          };
        }),
      };
    }),
    skippedBookings: (response.skippedShipments || []).map((item) => {
      const booking = bookingByIndex.get(item.index);
      return {
        bookingId: booking?.id || null,
        bookingCode: booking?.bookingCode || item.label || null,
        reasons: item.reasons || [],
      };
    }),
    totalCost: response.metrics?.totalCost ?? null,
    rawMetrics: response.metrics || null,
  };
};

module.exports = {
  optimizeActiveBookings,
};
