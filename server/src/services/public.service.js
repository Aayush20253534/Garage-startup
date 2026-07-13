const prisma = require("../config/prisma");
const { getCache, setCache } = require("../utils/cache");

const PUBLIC_STATS_TTL_SECONDS = Number(process.env.PUBLIC_STATS_CACHE_TTL || 60);
const PUBLIC_STATS_CACHE_KEY = "public:stats:v2";

const AVAILABLE_GARAGE_WHERE = {
  isVerified: true,
  isActive: true,
};

const getStats = async () => {
  const cached = await getCache(PUBLIC_STATS_CACHE_KEY);
  if (cached) return cached;

  const [garageStats, customers] = await Promise.all([
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
  ]);

  const stats = {
    garages: garageStats._count._all,
    customers,
    averageRating: Number(garageStats._avg.ratingAvg ?? 0),
  };

  await setCache(PUBLIC_STATS_CACHE_KEY, stats, PUBLIC_STATS_TTL_SECONDS);
  return stats;
};

module.exports = {
  getStats,
};
