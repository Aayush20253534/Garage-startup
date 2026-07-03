const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { verifyToken } = require("../utils/jwt");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new ApiError(401, "Authentication token missing"));
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
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

    if (!user) {
      return next(new ApiError(401, "User no longer exists"));
    }

    if (!user.isActive) {
      return next(new ApiError(403, "Account is disabled"));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

const optionalProtect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return next();

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
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

    if (user?.isActive) {
      req.user = user;
    }

    return next();
  } catch {
    return next();
  }
};

module.exports = {
  optionalProtect,
  protect,
};
