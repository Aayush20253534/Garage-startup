const prisma = require("../config/prisma");
const { getCache, setCache } = require("../utils/cache");
const {
  getActivePublicBoosts,
} = require("../admin/services/pseudoData.service");

const PUBLIC_STATS_TTL_SECONDS = Number(process.env.PUBLIC_STATS_CACHE_TTL || 60);
const PUBLIC_STATS_CACHE_KEY = "public:stats:v2";

const AVAILABLE_GARAGE_WHERE = {
  isVerified: true,
  isActive: true,
};

const getStats = async () => {
  const cached = await getCache(PUBLIC_STATS_CACHE_KEY);
  if (cached) return cached;

  const [garageStats, customers, boosts] = await Promise.all([
    prisma.garage.aggregate({
      where: AVAILABLE_GARAGE_WHERE,
      _count: { _all: true },
      _avg: { ratingAvg: true },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        isActive: true,
      },
    }),
    getActivePublicBoosts().catch(() => ({
      enabled: false,
      extraUsers: 0,
      extraGarages: 0,
    })),
  ]);

  const extraUsers = boosts?.enabled ? Number(boosts.extraUsers) || 0 : 0;
  const extraGarages = boosts?.enabled ? Number(boosts.extraGarages) || 0 : 0;

  const stats = {
    garages: garageStats._count._all + extraGarages,
    customers: customers + extraUsers,
    averageRating: Number(garageStats._avg.ratingAvg ?? 0),
  };

  await setCache(PUBLIC_STATS_CACHE_KEY, stats, PUBLIC_STATS_TTL_SECONDS);
  return stats;
};

module.exports = {
  getStats,
};
