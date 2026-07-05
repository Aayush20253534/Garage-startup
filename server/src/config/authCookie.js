const ACCESS_TOKEN_COOKIE_NAME = "accessToken";

const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const configuredMaxAge = Number(process.env.JWT_COOKIE_MAX_AGE_MS);

const accessTokenCookieOptions = Object.freeze({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge:
    Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
      ? configuredMaxAge
      : DEFAULT_COOKIE_MAX_AGE_MS,
});

const accessTokenClearCookieOptions = Object.freeze({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

module.exports = {
  ACCESS_TOKEN_COOKIE_NAME,
  accessTokenCookieOptions,
  accessTokenClearCookieOptions,
};
