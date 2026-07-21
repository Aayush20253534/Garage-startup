const prisma = require("../config/prisma");

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SESSION_MODELS = [
  "userSession",
  "staffSession",
  "garageOwnerSession",
  "customerSupportSession",
];

let cleanupTimer = null;

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const runSessionRetentionCleanup = async (now = new Date()) => {
  const retentionDays = positiveNumber(
    process.env.SESSION_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
  );
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const where = {
    OR: [
      { expiresAt: { lt: cutoff } },
      { revokedAt: { not: null, lt: cutoff } },
    ],
  };

  const results = await Promise.all(
    SESSION_MODELS.map((model) => prisma[model].deleteMany({ where })),
  );
  return results.reduce((total, result) => total + result.count, 0);
};

const startSessionRetentionCleanup = () => {
  if (cleanupTimer) return cleanupTimer;
  const intervalMs = positiveNumber(
    process.env.SESSION_CLEANUP_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
  );
  void runSessionRetentionCleanup().catch((error) => {
    console.error("Session retention cleanup failed:", error);
  });
  cleanupTimer = setInterval(() => {
    void runSessionRetentionCleanup().catch((error) => {
      console.error("Session retention cleanup failed:", error);
    });
  }, intervalMs);
  cleanupTimer.unref?.();
  return cleanupTimer;
};

const stopSessionRetentionCleanup = () => {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = null;
};

module.exports = {
  runSessionRetentionCleanup,
  startSessionRetentionCleanup,
  stopSessionRetentionCleanup,
};
