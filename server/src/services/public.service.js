const prisma = require("../config/prisma");
const { getCache, setCache } = require("../utils/cache");

const PUBLIC_STATS_TTL_SECONDS = Number(process.env.PUBLIC_STATS_CACHE_TTL || 60);

const getStats = async () => {
  const cacheKey = "public:stats";
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const [garages, customers] = await Promise.all([
    prisma.garage.count({
      where: {
        isVerified: true,
        isActive: true,
      },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        isActive: true,
      },
    }),
  ]);

  const stats = { garages, customers };
  await setCache(cacheKey, stats, PUBLIC_STATS_TTL_SECONDS);
  return stats;
};

module.exports = {
  getStats,
};
