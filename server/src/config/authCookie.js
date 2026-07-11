const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
const SUPPORT_ACCESS_TOKEN_COOKIE_NAME = "supportAccessToken";
const DEVICE_ID_COOKIE_NAME = "rovautoDeviceId";

const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEVICE_ID_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const configuredMaxAge = Number(process.env.JWT_COOKIE_MAX_AGE_MS);
const isProduction = process.env.NODE_ENV === "production";

const sharedCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

const accessTokenCookieOptions = Object.freeze({
  ...sharedCookieOptions,
  maxAge:
    Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
      ? configuredMaxAge
      : DEFAULT_COOKIE_MAX_AGE_MS,
});

const accessTokenClearCookieOptions = Object.freeze({
  ...sharedCookieOptions,
});

const supportAccessTokenCookieOptions = Object.freeze({
  ...accessTokenCookieOptions,
});

const supportAccessTokenClearCookieOptions = Object.freeze({
  ...accessTokenClearCookieOptions,
});

const deviceIdCookieOptions = Object.freeze({
  ...sharedCookieOptions,
  maxAge: DEVICE_ID_COOKIE_MAX_AGE_MS,
});

module.exports = {
  ACCESS_TOKEN_COOKIE_NAME,
  SUPPORT_ACCESS_TOKEN_COOKIE_NAME,
  DEVICE_ID_COOKIE_NAME,
  accessTokenCookieOptions,
  accessTokenClearCookieOptions,
  supportAccessTokenCookieOptions,
  supportAccessTokenClearCookieOptions,
  deviceIdCookieOptions,
};
