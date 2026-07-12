const ApiError = require("../utils/apiError");

const concurrencyLimit = ({
  max = 50,
  message = "The authentication service is busy. Please try again shortly.",
} = {}) => {
  const activeLimit = Math.max(1, Number(max) || 50);
  let activeRequests = 0;

  return (req, res, next) => {
    if (activeRequests >= activeLimit) {
      return next(new ApiError(503, message, "AUTH_BUSY"));
    }

    activeRequests += 1;
    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      activeRequests = Math.max(0, activeRequests - 1);
    };

    res.once("finish", release);
    res.once("close", release);

    return next();
  };
};

module.exports = concurrencyLimit;
