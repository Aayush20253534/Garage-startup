const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteCache } = require("../../utils/cache");

const PUBLIC_STATS_CACHE_KEY = "public:stats:v2";
const SETTINGS_ID = "default";
const MAX_EXTRA = 1_000_000;
const MIN_RATING = 1;
const MAX_RATING = 5;

const AVAILABLE_GARAGE_WHERE = {
  isVerified: true,
  isActive: true,
};

const clampExtra = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_EXTRA, Math.floor(n)));
};

const normalizeRating = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  if (rounded < MIN_RATING || rounded > MAX_RATING) {
    throw new ApiError(
      400,
      `pseudoAverageRating must be between ${MIN_RATING} and ${MAX_RATING}`,
    );
  }
  return rounded;
};

const ensureSettings = async (client = prisma) => {
  const existing = await client.platformPseudoData.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return existing;

  try {
    return await client.platformPseudoData.create({
      data: {
        id: SETTINGS_ID,
        enabled: false,
        extraUsers: 0,
        extraGarages: 0,
        pseudoAverageRating: null,
      },
    });
  } catch {
    return client.platformPseudoData.findUnique({
      where: { id: SETTINGS_ID },
    });
  }
};

const getRealCounts = async () => {
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

  return {
    realUsers: customers,
    realGarages: garageStats._count._all,
    realAverageRating: Number(garageStats._avg.ratingAvg ?? 0),
  };
};

const toPublicPayload = (settings, real) => {
  const enabled = Boolean(settings?.enabled);
  const extraUsers = clampExtra(settings?.extraUsers);
  const extraGarages = clampExtra(settings?.extraGarages);
  const pseudoAverageRating =
    settings?.pseudoAverageRating === null ||
    settings?.pseudoAverageRating === undefined
      ? null
      : Number(settings.pseudoAverageRating);

  const displayAverageRating =
    enabled && pseudoAverageRating !== null
      ? pseudoAverageRating
      : real.realAverageRating;

  return {
    enabled,
    extraUsers,
    extraGarages,
    pseudoAverageRating,
    realUsers: real.realUsers,
    realGarages: real.realGarages,
    realAverageRating: real.realAverageRating,
    displayUsers: real.realUsers + (enabled ? extraUsers : 0),
    displayGarages: real.realGarages + (enabled ? extraGarages : 0),
    displayAverageRating,
    updatedAt: settings?.updatedAt || null,
    updatedByStaffId: settings?.updatedByStaffId || null,
    updatedByStaffName: settings?.updatedByStaffName || null,
  };
};

const getPseudoDataSettings = async () => {
  const [settings, real] = await Promise.all([
    ensureSettings(),
    getRealCounts(),
  ]);
  return toPublicPayload(settings, real);
};

/**
 * Boosts applied to public stats only when pseudo data is enabled.
 */
const getActivePublicBoosts = async () => {
  const settings = await ensureSettings();
  if (!settings?.enabled) {
    return {
      enabled: false,
      extraUsers: 0,
      extraGarages: 0,
      pseudoAverageRating: null,
    };
  }
  return {
    enabled: true,
    extraUsers: clampExtra(settings.extraUsers),
    extraGarages: clampExtra(settings.extraGarages),
    pseudoAverageRating:
      settings.pseudoAverageRating === null ||
      settings.pseudoAverageRating === undefined
        ? null
        : Number(settings.pseudoAverageRating),
  };
};

const updatePseudoDataSettings = async (payload, staff) => {
  const enabled =
    payload?.enabled === true ||
    payload?.enabled === "true" ||
    payload?.enabled === 1;

  if (payload?.extraUsers !== undefined && payload?.extraUsers !== null) {
    const n = Number(payload.extraUsers);
    if (!Number.isFinite(n) || n < 0 || n > MAX_EXTRA) {
      throw new ApiError(
        400,
        `extraUsers must be an integer between 0 and ${MAX_EXTRA}`,
      );
    }
  }
  if (payload?.extraGarages !== undefined && payload?.extraGarages !== null) {
    const n = Number(payload.extraGarages);
    if (!Number.isFinite(n) || n < 0 || n > MAX_EXTRA) {
      throw new ApiError(
        400,
        `extraGarages must be an integer between 0 and ${MAX_EXTRA}`,
      );
    }
  }

  await ensureSettings();
  const current = await prisma.platformPseudoData.findUnique({
    where: { id: SETTINGS_ID },
  });

  const extraUsers = clampExtra(
    payload?.extraUsers !== undefined && payload?.extraUsers !== null
      ? payload.extraUsers
      : current?.extraUsers ?? 0,
  );
  const extraGarages = clampExtra(
    payload?.extraGarages !== undefined && payload?.extraGarages !== null
      ? payload.extraGarages
      : current?.extraGarages ?? 0,
  );

  let pseudoAverageRating = current?.pseudoAverageRating ?? null;
  if (Object.prototype.hasOwnProperty.call(payload || {}, "pseudoAverageRating")) {
    pseudoAverageRating = normalizeRating(payload.pseudoAverageRating);
  }

  const settings = await prisma.platformPseudoData.update({
    where: { id: SETTINGS_ID },
    data: {
      enabled,
      extraUsers,
      extraGarages,
      pseudoAverageRating,
      updatedByStaffId: staff?.id || null,
      updatedByStaffName: staff?.name || staff?.loginId || staff?.email || null,
    },
  });

  await deleteCache(PUBLIC_STATS_CACHE_KEY);

  const real = await getRealCounts();
  return toPublicPayload(settings, real);
};

module.exports = {
  getPseudoDataSettings,
  getActivePublicBoosts,
  updatePseudoDataSettings,
  PUBLIC_STATS_CACHE_KEY,
  MAX_EXTRA,
  MIN_RATING,
  MAX_RATING,
};
