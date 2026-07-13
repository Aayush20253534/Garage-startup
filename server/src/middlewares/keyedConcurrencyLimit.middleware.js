const ApiError = require("../utils/apiError");

const normalizeLimit = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const createKeyedConcurrencyLimit = ({
  name = "request",
  maxGlobal = 4,
  maxPerKey = 1,
  keyGenerator = (req) => req.user?.id || req.ip || "anonymous",
} = {}) => {
  const activeByKey = new Map();
  let activeGlobal = 0;
  const globalLimit = normalizeLimit(maxGlobal, 4);
  const perKeyLimit = normalizeLimit(maxPerKey, 1);

  return (req, res, next) => {
    const key = String(keyGenerator(req) || "anonymous").slice(0, 200);
    const activeForKey = activeByKey.get(key) || 0;

    if (activeGlobal >= globalLimit || activeForKey >= perKeyLimit) {
      res.setHeader("Retry-After", "5");
      return next(
        new ApiError(
          429,
          `Another ${name} is already being processed. Please try again shortly.`,
          "CONCURRENCY_LIMITED",
        ),
      );
    }

    activeGlobal += 1;
    activeByKey.set(key, activeForKey + 1);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeGlobal = Math.max(0, activeGlobal - 1);

      const remaining = (activeByKey.get(key) || 1) - 1;
      if (remaining > 0) {
        activeByKey.set(key, remaining);
      } else {
        activeByKey.delete(key);
      }
    };

    res.once("finish", release);
    res.once("close", release);
    return next();
  };
};

module.exports = createKeyedConcurrencyLimit;
