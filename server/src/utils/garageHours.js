const DEFAULT_GARAGE_TIME_ZONE = "Asia/Kolkata";
const formatterCache = new Map();

const parseClockMinutes = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
};

const getTimeFormatter = (timeZone) => {
  const requested = String(timeZone || DEFAULT_GARAGE_TIME_ZONE).trim();
  if (formatterCache.has(requested)) return formatterCache.get(requested);

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: requested,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: DEFAULT_GARAGE_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }

  formatterCache.set(requested, formatter);
  return formatter;
};

const getCurrentClockMinutes = (
  date = new Date(),
  timeZone = process.env.APP_TIME_ZONE || DEFAULT_GARAGE_TIME_ZONE,
) => {
  const parts = Object.fromEntries(
    getTimeFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return Number(parts.hour) * 60 + Number(parts.minute);
};

const isGarageOpenNow = (
  garage,
  date = new Date(),
  timeZone = process.env.APP_TIME_ZONE || DEFAULT_GARAGE_TIME_ZONE,
) => {
  if (!garage?.openingTime || !garage?.closingTime) return true;

  const openingMinutes = parseClockMinutes(garage.openingTime);
  const closingMinutes = parseClockMinutes(garage.closingTime);
  if (openingMinutes === null || closingMinutes === null) return false;

  const currentMinutes = getCurrentClockMinutes(date, timeZone);

  if (openingMinutes <= closingMinutes) {
    return currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
  }

  return currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
};

module.exports = {
  DEFAULT_GARAGE_TIME_ZONE,
  getCurrentClockMinutes,
  isGarageOpenNow,
  parseClockMinutes,
};
