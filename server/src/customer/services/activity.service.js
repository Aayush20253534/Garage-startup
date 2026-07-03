const prisma = require("../../config/prisma");

const MAX_ACTIVITY_LIMIT = 50;

const normalizeLimit = (limit) => {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), MAX_ACTIVITY_LIMIT);
};

const listActivities = async (userId, { limit } = {}) => {
  return prisma.customerActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: normalizeLimit(limit),
  });
};

const createActivity = async (
  userId,
  { type = "SYSTEM", title, detail = "", path = "", metadata = undefined },
) => {
  return prisma.customerActivity.create({
    data: {
      userId,
      type: String(type || "SYSTEM").trim().slice(0, 40) || "SYSTEM",
      title: String(title || "").trim().slice(0, 120),
      detail: String(detail || "").trim().slice(0, 300),
      path: String(path || "").trim().slice(0, 160),
      metadata,
    },
  });
};

module.exports = {
  createActivity,
  listActivities,
};
