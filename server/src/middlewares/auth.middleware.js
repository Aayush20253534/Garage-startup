const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { verifyToken } = require("../utils/jwt");
const {
  ensureLegacyUserSession,
  getActiveUserSession,
  touchUserSession,
} = require("../customer/services/userSession.service");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  accessTokenClearCookieOptions,
} = require("../config/authCookie");

const VALID_ACCOUNT_TYPES = new Set(["USER", "STAFF", "CUSTOMER_SUPPORT"]);
const STAFF_ROLES = new Set(["ADMIN", "INTERN"]);
const USER_ROLES = new Set(["CUSTOMER", "GARAGE_OWNER"]);
const CUSTOMER_SUPPORT_ROLE = "CUSTOMER_SUPPORT";

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

  if (decoded?.role === CUSTOMER_SUPPORT_ROLE) {
    return "CUSTOMER_SUPPORT";
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

  if (accountType === "CUSTOMER_SUPPORT") {
    const supportAccount = await prisma.customerSupportAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
      },
    });

    return supportAccount
      ? {
          ...supportAccount,
          role: CUSTOMER_SUPPORT_ROLE,
          accountType: "CUSTOMER_SUPPORT",
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
      accountType !== "USER" &&
      account.passwordChangedAt &&
      decoded.iat &&
      account.passwordChangedAt.getTime() > decoded.iat * 1000 + 1000
    ) {
      clearAccessTokenCookie(res);

      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Password changed. Please log in again"));
    }

    let authSessionId = null;

    if (accountType === "USER") {
      if (decoded.sessionId) {
        const session = await getActiveUserSession(
          decoded.sessionId,
          account.id,
        );

        if (!session) {
          clearAccessTokenCookie(res);

          if (optional) {
            return next();
          }

          return next(new ApiError(401, "Invalid or expired session"));
        }

        authSessionId = session.id;
        await touchUserSession(session.id, account.id);
      } else {
        authSessionId = await ensureLegacyUserSession({
          userId: account.id,
          tokenExpiresAt: decoded.exp
            ? new Date(decoded.exp * 1000)
            : null,
          userAgent: req.get("user-agent") || "",
        });
      }
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
            : requiredAccountType === "CUSTOMER_SUPPORT"
              ? "Customer support access required"
              : "User account required",
        ),
      );
    }

    req.user = account;
    req.authSessionId = authSessionId;
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

const protectCustomerSupport = (req, res, next) =>
  authenticateRequest(req, res, next, {
    requiredAccountType: "CUSTOMER_SUPPORT",
  });

const optionalProtect = (req, res, next) =>
  authenticateRequest(req, res, next, {
    optional: true,
  });

module.exports = {
  optionalProtect,
  protect,
  protectCustomerSupport,
  protectStaff,
  protectUser,
};
