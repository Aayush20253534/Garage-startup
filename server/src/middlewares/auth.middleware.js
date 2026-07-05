const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { verifyToken } = require("../utils/jwt");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  accessTokenClearCookieOptions,
} = require("../config/authCookie");

const readAccessToken = (req) =>
  req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] || null;

const clearAccessTokenCookie = (res) => {
  res.clearCookie(
    ACCESS_TOKEN_COOKIE_NAME,
    accessTokenClearCookieOptions,
  );
};

const getActiveUser = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      isEmailVerified: true,
      isOnboarded: true,
    },
  });
};

const protect = async (req, res, next) => {
  try {
    const token = readAccessToken(req);

    if (!token) {
      return next(new ApiError(401, "Authentication required"));
    }

    const decoded = verifyToken(token);
    const user = await getActiveUser(decoded.id);

    if (!user) {
      clearAccessTokenCookie(res);
      return next(new ApiError(401, "User no longer exists"));
    }

    if (!user.isActive) {
      clearAccessTokenCookie(res);
      return next(new ApiError(403, "Account is disabled"));
    }

    req.user = user;
    return next();
  } catch {
    clearAccessTokenCookie(res);
    return next(new ApiError(401, "Invalid or expired session"));
  }
};

const optionalProtect = async (req, res, next) => {
  try {
    const token = readAccessToken(req);

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    const user = await getActiveUser(decoded.id);

    if (user?.isActive) {
      req.user = user;
    } else {
      clearAccessTokenCookie(res);
    }

    return next();
  } catch {
    clearAccessTokenCookie(res);
    return next();
  }
};

module.exports = {
  optionalProtect,
  protect,
};
