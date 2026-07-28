const prisma = require("../../config/prisma");
const {
  WARRANTY_DURATION_DAYS,
  buildWarrantyRecord,
} = require("./warranty.utils");

const getCustomerWarranties = async (userId) => {
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "COMPLETED",
      garageId: { not: null },
    },
    select: {
      id: true,
      bookingCode: true,
      customerAcceptedAt: true,
      deliveredAt: true,
      updatedAt: true,
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          fuelType: true,
          registrationNumber: true,
        },
      },
      garage: {
        select: {
          id: true,
          name: true,
          city: true,
          area: true,
        },
      },
      services: {
        orderBy: { createdAt: "asc" },
        select: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ customerAcceptedAt: "desc" }, { updatedAt: "desc" }],
  });

  const now = new Date();
  return bookings.map((booking) => buildWarrantyRecord(booking, now));
};

module.exports = {
  WARRANTY_DURATION_DAYS,
  buildWarrantyRecord,
  getCustomerWarranties,
};
