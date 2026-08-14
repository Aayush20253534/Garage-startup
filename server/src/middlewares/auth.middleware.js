const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { verifyToken } = require("../utils/jwt");
const {
  getActiveCustomerSupportSession,
  getActiveGarageOwnerSession,
  getActiveGarageControllerSession,
  getActiveStaffSession,
  getActiveUserSession,
  touchCustomerSupportSession,
  touchGarageOwnerSession,
  touchGarageControllerSession,
  touchStaffSession,
  touchUserSession,
} = require("../customer/services/userSession.service");
const {
  ACCESS_TOKEN_COOKIE_NAME,
  SUPPORT_ACCESS_TOKEN_COOKIE_NAME,
  accessTokenClearCookieOptions,
  supportAccessTokenClearCookieOptions,
} = require("../config/authCookie");

const VALID_ACCOUNT_TYPES = new Set(["USER", "STAFF", "CUSTOMER_SUPPORT", "GARAGE_CONTROLLER"]);
const STAFF_ROLES = new Set(["ADMIN", "SUB_ADMIN", "INTERN"]);
const USER_ROLES = new Set(["CUSTOMER", "GARAGE_OWNER"]);
const CUSTOMER_SUPPORT_ROLE = "CUSTOMER_SUPPORT";
const CUSTOMER_BLOCKED_MESSAGE =
  "You are blocked from using Rovauto. Please contact customer support.";
const CUSTOMER_BLOCKED_CODE = "CUSTOMER_BLOCKED";

const readAccessToken = (req, cookieName = ACCESS_TOKEN_COOKIE_NAME) =>
  req.cookies?.[cookieName] || null;

const clearAccessTokenCookie = (
  res,
  cookieName = ACCESS_TOKEN_COOKIE_NAME,
) => {
  res.clearCookie(
    cookieName,
    cookieName === SUPPORT_ACCESS_TOKEN_COOKIE_NAME
      ? supportAccessTokenClearCookieOptions
      : accessTokenClearCookieOptions,
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

  if (decoded?.role === "GARAGE_CONTROLLER") {
    return "GARAGE_CONTROLLER";
  }

  return null;
};

const getActiveAccount = async (accountId, accountType, role = null) => {
  if (accountType === "GARAGE_CONTROLLER") {
    const controller = await prisma.garageController.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        garageId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        availability: true,
        passwordChangedAt: true,
        lastLoginAt: true,
        lastActiveAt: true,
        avatarUrl: true,
        deletedAt: true,
        createdAt: true,
        garage: { select: { controllerAccountsEnabled: true, isActive: true } },
      },
    });
    return controller &&
      !controller.deletedAt &&
      controller.garage?.isActive !== false &&
      controller.garage?.controllerAccountsEnabled !== false
      ? { ...controller, accountType: "GARAGE_CONTROLLER" }
      : null;
  }

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
        avatarUrl: true,
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
        avatarUrl: true,
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
    if (role === "GARAGE_OWNER") {
      const garageOwner = await prisma.garageOwner.findUnique({
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
          passwordChangedAt: true,
          avatarUrl: true,
        },
      });

      return garageOwner
        ? {
            ...garageOwner,
            accountType: "USER",
          }
        : null;
    }

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
        vehicleRegistrationRequired: true,
        customerProfile: { select: { avatarUrl: true } },
        createdAt: true,
        passwordChangedAt: true,
      },
    });

    return user
      ? {
          ...user,
          avatarUrl: user.customerProfile?.avatarUrl || null,
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
    tokenCookieName = ACCESS_TOKEN_COOKIE_NAME,
  } = {},
) => {
  try {
    const token = readAccessToken(req, tokenCookieName);

    if (!token) {
      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Authentication required"));
    }

    const decoded = verifyToken(token);
    const accountType = resolveAccountType(decoded);

    if (!accountType) {
      clearAccessTokenCookie(res, tokenCookieName);

      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Invalid account session"));
    }

    const account = await getActiveAccount(
      decoded.id,
      accountType,
      decoded.role,
    );

    if (!account) {
      clearAccessTokenCookie(res, tokenCookieName);

      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Account no longer exists"));
    }

    if (!account.isActive) {
      clearAccessTokenCookie(res, tokenCookieName);

      if (optional) {
        return next();
      }

      const isBlockedCustomer =
        accountType === "USER" && account.role === "CUSTOMER";

      return next(
        new ApiError(
          403,
          isBlockedCustomer
            ? CUSTOMER_BLOCKED_MESSAGE
            : "Account is disabled",
          isBlockedCustomer ? CUSTOMER_BLOCKED_CODE : null,
        ),
      );
    }

    if (
      account.passwordChangedAt &&
      decoded.iat &&
      account.passwordChangedAt.getTime() > decoded.iat * 1000 + 1000
    ) {
      clearAccessTokenCookie(res, tokenCookieName);

      if (optional) {
        return next();
      }

      return next(new ApiError(401, "Password changed. Please log in again"));
    }

    let authSessionId = null;

    if (accountType === "USER") {
      if (decoded.sessionId) {
        const isGarageOwner = account.role === "GARAGE_OWNER";
        const session = isGarageOwner
          ? await getActiveGarageOwnerSession(decoded.sessionId, account.id)
          : await getActiveUserSession(decoded.sessionId, account.id);

        if (!session) {
          clearAccessTokenCookie(res, tokenCookieName);

          if (optional) {
            return next();
          }

          return next(new ApiError(401, "Invalid or expired session"));
        }

        authSessionId = session.id;
        if (isGarageOwner) {
          await touchGarageOwnerSession(session.id, account.id);
        } else {
          await touchUserSession(session.id, account.id);
        }
      } else {
        clearAccessTokenCookie(res, tokenCookieName);

        if (optional) {
          return next();
        }

        return next(
          new ApiError(401, "Legacy session expired. Please log in again"),
        );
      }
    } else if (accountType === "GARAGE_CONTROLLER") {
      if (!decoded.sessionId) {
        clearAccessTokenCookie(res, tokenCookieName);
        return next(new ApiError(401, "Invalid or expired session"));
      }
      const session = await getActiveGarageControllerSession(
        decoded.sessionId,
        account.id,
      );
      if (!session) {
        clearAccessTokenCookie(res, tokenCookieName);
        return next(new ApiError(401, "Invalid or expired session"));
      }
      authSessionId = session.id;
      const activeCutoff = new Date(Date.now() - 60_000);
      await Promise.all([
        touchGarageControllerSession(session.id, account.id),
        prisma.garageController.updateMany({
          where: {
            id: account.id,
            OR: [{ lastActiveAt: null }, { lastActiveAt: { lte: activeCutoff } }],
          },
          data: { lastActiveAt: new Date() },
        }),
      ]);
    } else if (accountType === "STAFF") {
      if (!decoded.sessionId) {
        clearAccessTokenCookie(res, tokenCookieName);

        if (optional) {
          return next();
        }

        return next(new ApiError(401, "Invalid or expired session"));
      }

      const session = await getActiveStaffSession(
        decoded.sessionId,
        account.id,
      );

      if (!session) {
        clearAccessTokenCookie(res, tokenCookieName);

        if (optional) {
          return next();
        }

        return next(new ApiError(401, "Invalid or expired session"));
      }

      authSessionId = session.id;
      await touchStaffSession(session.id, account.id);
    } else if (accountType === "CUSTOMER_SUPPORT") {
      if (!decoded.sessionId) {
        clearAccessTokenCookie(res, tokenCookieName);

        if (optional) {
          return next();
        }

        return next(new ApiError(401, "Invalid or expired session"));
      }

      const session = await getActiveCustomerSupportSession(
        decoded.sessionId,
        account.id,
      );

      if (!session) {
        clearAccessTokenCookie(res, tokenCookieName);

        if (optional) {
          return next();
        }

        return next(new ApiError(401, "Invalid or expired session"));
      }

      authSessionId = session.id;
      await touchCustomerSupportSession(session.id, account.id);
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
    clearAccessTokenCookie(res, tokenCookieName);

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
    tokenCookieName: SUPPORT_ACCESS_TOKEN_COOKIE_NAME,
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
