const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { verifyToken } = require("../utils/jwt");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  accessTokenClearCookieOptions,
} = require("../config/authCookie");

const VALID_ACCOUNT_TYPES = new Set(["USER", "STAFF"]);
const STAFF_ROLES = new Set(["ADMIN", "INTERN"]);
const USER_ROLES = new Set(["CUSTOMER", "GARAGE_OWNER"]);

const readAccessToken = (req) =>
  req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] || null;

const clearAccessTokenCookie = (res) => {
  res.clearCookie(
    ACCESS_TOKEN_COOKIE_NAME,
    accessTokenClearCookieOptions,
  );
};

const resolveAccountType = (decoded) => {
  if (VALID_ACCOUNT_TYPES.has(decoded?.accountType)) {
    return decoded.accountType;
  }

  // Compatibility for JWTs issued immediately before the StaffAccount split.
  if (STAFF_ROLES.has(decoded?.role)) {
    return "STAFF";
  }

  if (USER_ROLES.has(decoded?.role)) {
    return "USER";
  }

  return null;
};

const getActiveAccount = async (accountId, accountType) => {
  if (accountType === "STAFF") {
    const staff = await prisma.staffAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        loginId: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
      },
    });

    return staff
      ? {
          ...staff,
          accountType: "STAFF",
        }
      : null;
  }

  if (accountType === "USER") {
    const user = await prisma.user.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        isOnboarded: true,
        createdAt: true,
      },
    });

    return user
      ? {
          ...user,
          accountType: "USER",
        }
      : null;
  }

  return null;
};

const authenticateRequest = async (
  req,
  res,
  next,
  {
    optional = false,
    requiredAccountType = null,
  } = {},
) => {
  try {
    const token = readAccessToken(req);

    if (!token) {
      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Authentication required"));
    }

    const decoded = verifyToken(token);
    const accountType = resolveAccountType(decoded);

    if (!accountType) {
      clearAccessTokenCookie(res);

      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Invalid account session"));
    }

    const account = await getActiveAccount(decoded.id, accountType);

    if (!account) {
      clearAccessTokenCookie(res);

      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Account no longer exists"));
    }

    if (!account.isActive) {
      clearAccessTokenCookie(res);

      if (optional) {
        return next();
      }

      return next(new ApiError(403, "Account is disabled"));
    }

    if (
      requiredAccountType &&
      account.accountType !== requiredAccountType
    ) {
      return next(
        new ApiError(
          403,
          requiredAccountType === "STAFF"
            ? "Staff access required"
            : "User account required",
        ),
      );
    }

    req.user = account;
    return next();
  } catch {
    clearAccessTokenCookie(res);

    if (optional) {
      return next();
    }

    return next(new ApiError(401, "Invalid or expired session"));
  }
};

const protect = (req, res, next) =>
  authenticateRequest(req, res, next);

const protectUser = (req, res, next) =>
  authenticateRequest(req, res, next, {
    requiredAccountType: "USER",
  });

const protectStaff = (req, res, next) =>
  authenticateRequest(req, res, next, {
    requiredAccountType: "STAFF",
  });

const optionalProtect = (req, res, next) =>
  authenticateRequest(req, res, next, {
    optional: true,
  });

module.exports = {
  optionalProtect,
  protect,
  protectStaff,
  protectUser,
};
