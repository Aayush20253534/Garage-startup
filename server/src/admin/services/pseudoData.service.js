const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteCache } = require("../../utils/cache");

const PUBLIC_STATS_CACHE_KEY = "public:stats:v2";
const SETTINGS_ID = "default";
const MAX_EXTRA = 1_000_000;

const AVAILABLE_GARAGE_WHERE = {
  isVerified: true,
  isActive: true,
};

const clampExtra = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_EXTRA, Math.floor(n)));
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
      },
    });
  } catch {
    return client.platformPseudoData.findUnique({
      where: { id: SETTINGS_ID },
    });
  }
};

const getRealCounts = async () => {
  const [garages, customers] = await Promise.all([
    prisma.garage.count({ where: AVAILABLE_GARAGE_WHERE }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        isActive: true,
      },
    }),
  ]);

  return { realUsers: customers, realGarages: garages };
};

const toPublicPayload = (settings, real) => {
  const enabled = Boolean(settings?.enabled);
  const extraUsers = clampExtra(settings?.extraUsers);
  const extraGarages = clampExtra(settings?.extraGarages);

  return {
    enabled,
    // Always return stored boosts so the admin form can re-enable without retyping.
    extraUsers,
    extraGarages,
    realUsers: real.realUsers,
    realGarages: real.realGarages,
    displayUsers: real.realUsers + (enabled ? extraUsers : 0),
    displayGarages: real.realGarages + (enabled ? extraGarages : 0),
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
 * Returns the boosts applied to public stats only when pseudo data is enabled.
 * Used by public.service so the homepage can show inflated counts.
 */
const getActivePublicBoosts = async () => {
  const settings = await ensureSettings();
  if (!settings?.enabled) {
    return { extraUsers: 0, extraGarages: 0, enabled: false };
  }
  return {
    enabled: true,
    extraUsers: clampExtra(settings.extraUsers),
    extraGarages: clampExtra(settings.extraGarages),
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

  const settings = await prisma.platformPseudoData.update({
    where: { id: SETTINGS_ID },
    data: {
      enabled,
      extraUsers,
      extraGarages,
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
};
