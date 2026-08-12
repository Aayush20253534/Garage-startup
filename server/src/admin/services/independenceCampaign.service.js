const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const SETTINGS_ID = "independence-day";
const MODES = ["OFF", "MANUAL", "SCHEDULED"];

const ensureSettings = () =>
  prisma.independenceCampaign.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });

const isActive = (settings, now = new Date()) => {
  if (settings.mode === "MANUAL") return settings.manualEnabled === true;
  if (settings.mode !== "SCHEDULED" || !settings.startsAt || !settings.endsAt) return false;
  return now >= settings.startsAt && now < settings.endsAt;
};

const toPayload = (settings) => ({
  mode: settings.mode,
  active: isActive(settings),
  manualEnabled: settings.manualEnabled,
  startsAt: settings.startsAt,
  endsAt: settings.endsAt,
  updatedAt: settings.updatedAt,
  updatedByStaffName: settings.updatedByStaffName,
});

const getSettings = async () => toPayload(await ensureSettings());

const getPublicStatus = async () => {
  const settings = await ensureSettings();
  return { active: isActive(settings), mode: settings.mode };
};

const updateSettings = async (payload, staff) => {
  const mode = String(payload?.mode || "").toUpperCase();
  if (!MODES.includes(mode)) throw new ApiError(400, "Mode must be OFF, MANUAL or SCHEDULED");

  const current = await ensureSettings();
  if (
    current.mode !== "OFF" &&
    mode !== "OFF" &&
    current.mode !== mode
  ) {
    throw new ApiError(409, `Deactivate ${current.mode.toLowerCase()} mode before enabling ${mode.toLowerCase()} mode`);
  }

  let data;
  if (mode === "OFF") {
    data = { mode, manualEnabled: false, startsAt: null, endsAt: null };
  } else if (mode === "MANUAL") {
    if (payload.manualEnabled !== true) throw new ApiError(400, "Manual mode must be explicitly enabled");
    data = { mode, manualEnabled: true, startsAt: null, endsAt: null };
  } else {
    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      throw new ApiError(400, "A valid start and end time are required");
    }
    if (endsAt <= startsAt) throw new ApiError(400, "End time must be after start time");
    data = { mode, manualEnabled: false, startsAt, endsAt };
  }

  const actorData = {
    updatedByStaffId: staff?.id || null,
    updatedByStaffName: staff?.name || staff?.loginId || staff?.email || null,
  };
  const settings = await prisma.independenceCampaign.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data, ...actorData },
    update: { ...data, ...actorData },
  });
  return toPayload(settings);
};

module.exports = { getPublicStatus, getSettings, updateSettings };
