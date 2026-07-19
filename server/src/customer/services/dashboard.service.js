const prisma = require("../../config/prisma");
const { getCache, setCache } = require("../../utils/cache");

const DASHBOARD_TTL = Number(process.env.DASHBOARD_CACHE_TTL || 60);

const ACTIVE_STATUSES = [
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const withUserAccountType = (user) =>
  user
    ? {
        ...user,
        accountType: "USER",
      }
    : user;

const bookingListInclude = {
  vehicle: true,

  garage: {
    select: {
      id: true,
      name: true,
      phone: true,
      whatsappNo: true,
      latitude: true,
      longitude: true,
      area: true,
      city: true,
      ratingAvg: true,
      ratingCount: true,
      isVerified: true,
      description: true,
      address: true,
      garageType: true,
      supportedBrands: true,
      openingTime: true,
      closingTime: true,
      images: {
        orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
        select: {
          id: true,
          imageUrl: true,
          order: true,
          isThumbnail: true,
        },
      },
      services: {
        where: { isActive: true },
        select: {
          serviceId: true,
          vehicleBrand: true,
          vehicleModel: true,
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },

  services: {
    include: {
      service: {
        select: {
          id: true,
          name: true,
          durationMin: true,
        },
      },
    },
  },

  payment: true,
  review: true,
};

const getCustomerDashboard = async (userId) => {
  const cacheKey = `customer:${userId}:dashboard`;

  const cached = await getCache(cacheKey);

  if (cached) {
    return {
      ...cached,
      user: withUserAccountType(cached.user),
      fromCache: true,
    };
  }

  const [
    user,
    wallet,
    activeBookings,
    activeBookingsCount,
    completedBookingsCount,
    recentBookings,
  ] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          isOnboarded: true,
          isActive: true,
          customerProfile: true,
          vehicles: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          },
        },
      }),

      prisma.wallet.findUnique({
        where: { userId },
      }),

      prisma.booking.findMany({
        where: {
          userId,
          status: {
            in: ACTIVE_STATUSES,
          },
        },
        include: bookingListInclude,
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),

      prisma.booking.count({
        where: {
          userId,
          status: {
            in: ACTIVE_STATUSES,
          },
        },
      }),

      prisma.booking.count({
        where: {
          userId,
          status: "COMPLETED",
        },
      }),

      prisma.booking.findMany({
        where: {
          userId,
        },
        include: bookingListInclude,
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),
    ]);

  const userWithAccountType = withUserAccountType(user);
  const vehicles = userWithAccountType?.vehicles || [];

  const data = {
    user: userWithAccountType,
    vehicles,
    vehicle: vehicles.find((item) => item.isDefault) || vehicles[0] || null,
    wallet:
      wallet || {
        balance: 0,
    },
    activeBookings,
    activeBookingsCount,
    completedBookingsCount,
    recentBookings,
  };

  await setCache(cacheKey, data, DASHBOARD_TTL);

  return {
    ...data,
    fromCache: false,
  };
};

module.exports = {
  getCustomerDashboard,
};
