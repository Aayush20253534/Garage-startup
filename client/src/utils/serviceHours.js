export const SERVICE_TIME_ZONE = "Asia/Kolkata";
export const SERVICE_OPEN_MINUTES = 10 * 60;
export const SERVICE_CLOSE_MINUTES = 22 * 60;
export const SERVICE_HOURS_CLOSED_CODE = "SERVICE_HOURS_CLOSED";

export const SERVICE_HOURS_MESSAGE =
  "You can only pay between 10:00 AM and 10:00 PM (IST). Please retry during payment hours.";

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

export const isServiceHoursError = (error) => {
  const message = String(
    error?.response?.data?.message || error?.message || "",
  );

  return (
    error?.code === SERVICE_HOURS_CLOSED_CODE ||
    error?.response?.data?.code === SERVICE_HOURS_CLOSED_CODE ||
    /10:00 AM.*10:00 PM|payment hours|service hours/i.test(message)
  );
};

export const assertServiceHoursOpen = (date = new Date()) => {
  if (isWithinServiceHours(date)) {
    return true;
  }

  const error = new Error(SERVICE_HOURS_MESSAGE);
  error.code = SERVICE_HOURS_CLOSED_CODE;
  throw error;
};
