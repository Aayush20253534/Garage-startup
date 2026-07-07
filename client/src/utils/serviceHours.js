export const SERVICE_TIME_ZONE = "Asia/Kolkata";
export const SERVICE_OPEN_MINUTES = 10 * 60;
export const SERVICE_CLOSE_MINUTES = 24 * 60;

export const SERVICE_HOURS_MESSAGE =
  "Rovauto services are available daily from 10:00 AM to 10:00 PM (IST). Please try again during service hours.";

const indiaTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVICE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const getIndiaMinutesSinceMidnight = (date = new Date()) => {
  const parts = indiaTimeFormatter.formatToParts(date);

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value || 0,
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );

  return hour * 60 + minute;
};

export const isWithinServiceHours = (date = new Date()) => {
  const currentMinutes = getIndiaMinutesSinceMidnight(date);

  return (
    currentMinutes >= SERVICE_OPEN_MINUTES &&
    currentMinutes < SERVICE_CLOSE_MINUTES
  );
};

export const assertServiceHoursOpen = (date = new Date()) => {
  if (isWithinServiceHours(date)) {
    return true;
  }

  const error = new Error(SERVICE_HOURS_MESSAGE);
  error.code = "SERVICE_HOURS_CLOSED";
  throw error;
};
