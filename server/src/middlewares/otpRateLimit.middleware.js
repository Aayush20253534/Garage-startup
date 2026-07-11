const rateLimit = require("./rateLimit.middleware");

const normalizeOtpIdentifier = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const otpKeyGenerator = (req) => {
  const identifier =
    req.body?.email ||
    req.body?.phone ||
    req.body?.identifier ||
    "otp";

  return `${req.ip}:${normalizeOtpIdentifier(identifier)}`;
};

const otpCooldownRateLimit = rateLimit({
  name: "otp-cooldown",
  windowMs: 60 * 1000,
  max: 1,
  fallbackMax: 1,
  keyGenerator: otpKeyGenerator,
  message: "Please wait 60 seconds before requesting another OTP.",
});

const otpHourlyRateLimit = rateLimit({
  name: "otp-hourly",
  windowMs: 60 * 60 * 1000,
  max: 5,
  fallbackMax: 3,
  keyGenerator: otpKeyGenerator,
  message: "Too many OTP requests. Please try again in an hour.",
});

const otpDailyRateLimit = rateLimit({
  name: "otp-daily",
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  fallbackMax: 6,
  keyGenerator: otpKeyGenerator,
  message: "Daily OTP request limit reached. Please try again tomorrow.",
});

const otpSendRateLimits = [
  otpCooldownRateLimit,
  otpHourlyRateLimit,
  otpDailyRateLimit,
];

module.exports = {
  otpSendRateLimits,
};
