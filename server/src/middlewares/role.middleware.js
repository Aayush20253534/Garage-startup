const ApiError = require("../utils/apiError");

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You are not allowed to access this resource"),
      );
    }

    if (
      req.user.role === "GARAGE_OWNER" &&
      !req.user.passwordChangedAt
    ) {
      return next(
        new ApiError(
          403,
          "Change your temporary password before using the garage portal.",
          "GARAGE_PASSWORD_CHANGE_REQUIRED",
        ),
      );
    }

    return next();
  };
};

module.exports = {
  authorizeRoles,
};
