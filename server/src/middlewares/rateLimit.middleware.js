const ApiError = require("../utils/apiError");
const redis = require("../config/redis");
const { ensureRedisConnected, withTimeout } = require("../utils/cache");

const buckets = new Map();
const MAX_MEMORY_BUCKETS = 10000;

const normalizeKeyPart = (value) =>
  String(value || "anonymous")
    .replace(/\s+/g, "_")
    .slice(0, 200);

const cleanupExpiredMemoryBuckets = (now) => {
  if (buckets.size < MAX_MEMORY_BUCKETS) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const incrementRedisBucket = async (key, windowMs) => {
  const connected = await ensureRedisConnected();
  if (!connected || !redis) return null;

  const script = `
    local count = redis.call("INCR", KEYS[1])
    if count == 1 then
      redis.call("PEXPIRE", KEYS[1], ARGV[1])
    end
    local ttl = redis.call("PTTL", KEYS[1])
    return { count, ttl }
  `;

  const result = await withTimeout(
    redis.eval(script, 1, key, String(windowMs)),
  );

  const count = Number(result?.[0] || 0);
  const ttl = Number(result?.[1] || windowMs);

  return {
    count,
    resetAt: Date.now() + Math.max(ttl, 0),
  };
};

const incrementMemoryBucket = (key, windowMs) => {
  const now = Date.now();
  cleanupExpiredMemoryBuckets(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = {
      count: 1,
      resetAt: now + windowMs,
    };

    buckets.set(key, nextBucket);
    return nextBucket;
  }

  bucket.count += 1;
  return bucket;
};

const applyRateLimitHeaders = (res, bucket, max) => {
  if (!bucket) return;

  res.setHeader("X-RateLimit-Limit", String(max));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(max - bucket.count, 0)),
  );
  res.setHeader(
    "X-RateLimit-Reset",
    String(Math.ceil(bucket.resetAt / 1000)),
  );
};

const rateLimit = ({
  windowMs = 60 * 1000,
  max = 30,
  fallbackMax = null,
  keyGenerator = (req) => req.ip,
  name = "global",
} = {}) => {
  const keyPrefix = [
    process.env.RATE_LIMIT_KEY_PREFIX || "rate-limit",
    normalizeKeyPart(name),
    max,
    windowMs,
  ].join(":");

  return async (req, res, next) => {
    const key = `${keyPrefix}:${normalizeKeyPart(keyGenerator(req))}`;
    let bucket = null;
    let usingMemoryFallback = false;

    try {
      bucket = await incrementRedisBucket(key, windowMs);
    } catch (error) {
      console.error("Redis rate limit failed:", error.message);
    }

    if (!bucket) {
      bucket = incrementMemoryBucket(key, windowMs);
      usingMemoryFallback = true;
    }

    const activeMax =
      usingMemoryFallback && Number.isFinite(Number(fallbackMax))
        ? Math.max(1, Number(fallbackMax))
        : max;

    applyRateLimitHeaders(res, bucket, activeMax);

    if (bucket.count > activeMax) {
      return next(new ApiError(429, "Too many requests. Please try again later."));
    }

    return next();
  };
};

module.exports = rateLimit;
