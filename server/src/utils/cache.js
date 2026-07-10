const redis = require("../config/redis");

const withTimeout = (promise, ms = Number(process.env.CACHE_TIMEOUT_MS || 1500)) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Cache operation timed out")), ms)
    ),
  ]);

const ensureRedisConnected = async () => {
  if (!redis) return false;

  if (redis.status === "ready") return true;

  if (
    redis.status === "wait" ||
    redis.status === "end" ||
    redis.status === "close"
  ) {
    try {
      await withTimeout(redis.connect());
      return redis.status === "ready";
    } catch (error) {
      console.error("Redis connect failed:", error.message);
      return false;
    }
  }

  return redis.status === "ready";
};

const getCache = async (key) => {
  try {
    const connected = await ensureRedisConnected();
    if (!connected) return null;

    const cached = await withTimeout(redis.get(key));

    if (!cached) {
      console.log(`[cache] miss: ${key}`);
      return null;
    }

    console.log(`[cache] hit: ${key}`);
    return JSON.parse(cached);
  } catch (error) {
    console.error(`Redis get failed for ${key}:`, error.message);
    return null;
  }
};

const setCache = async (key, data, ttlSeconds = 60) => {
  try {
    const connected = await ensureRedisConnected();
    if (!connected) return false;

    await withTimeout(redis.set(key, JSON.stringify(data), "EX", ttlSeconds));

    console.log(`[cache] set: ${key}`);
    return true;
  } catch (error) {
    console.error(`Redis set failed for ${key}:`, error.message);
    return false;
  }
};

const deleteCache = async (key) => {
  try {
    const connected = await ensureRedisConnected();
    if (!connected) return false;

    await withTimeout(redis.del(key));

    console.log(`[cache] deleted: ${key}`);
    return true;
  } catch (error) {
    console.error(`Redis delete failed for ${key}:`, error.message);
    return false;
  }
};

const deletePattern = async (pattern) => {
  try {
    const connected = await ensureRedisConnected();
    if (!connected) return false;

    const keys = [];
    let cursor = "0";

    do {
      const result = await withTimeout(redis.scan(cursor, "MATCH", pattern, "COUNT", 100));
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");

    if (keys.length === 0) {
      console.log(`[cache] no keys for pattern: ${pattern}`);
      return true;
    }

    await withTimeout(redis.del(...keys));

    console.log(`[cache] deleted pattern: ${pattern} (${keys.length} keys)`);
    return true;
  } catch (error) {
    console.error(`Redis pattern delete failed for ${pattern}:`, error.message);
    return false;
  }
};

module.exports = {
  ensureRedisConnected,
  getCache,
  setCache,
  deleteCache,
  deletePattern,
  withTimeout,
};
