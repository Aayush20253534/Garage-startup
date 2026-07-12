const rateLimit = require("./rateLimit.middleware");

const normalizeOtpIdentifier = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 200);

const otpKeyGenerator = (req) => {
  const identifier =
    req.body?.email ||
    req.body?.phone ||
    req.body?.identifier ||
    "otp";

  return `${req.ip}:${normalizeOtpIdentifier(identifier)}`;
};

const otpPerIpHourlyRateLimit = rateLimit({
  name: "otp-ip-hourly",
  windowMs: 60 * 60 * 1000,
  max: 30,
  fallbackMax: 12,
  keyGenerator: (req) => req.ip,
  message: "Too many OTP requests from this network. Please try again later.",
});

const otpPerIpDailyRateLimit = rateLimit({
  name: "otp-ip-daily",
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  fallbackMax: 40,
  keyGenerator: (req) => req.ip,
  message: "Daily OTP request limit reached for this network.",
});

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
  otpPerIpHourlyRateLimit,
  otpPerIpDailyRateLimit,
  otpCooldownRateLimit,
  otpHourlyRateLimit,
  otpDailyRateLimit,
];

module.exports = {
  otpSendRateLimits,
};
