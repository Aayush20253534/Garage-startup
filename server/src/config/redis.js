const Redis = require("ioredis");

let redis = null;

if (process.env.REDIS_URL) {
  const isTlsRedis =
    process.env.REDIS_URL.includes("upstash.io") ||
    process.env.REDIS_URL.startsWith("rediss://");

  redis = new Redis(process.env.REDIS_URL, {
    tls: isTlsRedis ? {} : undefined,

    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1500),
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 1500),

    retryStrategy(times) {
      if (times > 1) return null;
      return 300;
    },

    reconnectOnError(error) {
      const message = error.message || "";

      if (
        message.includes("READONLY") ||
        message.includes("ETIMEDOUT") ||
        message.includes("EPIPE") ||
        message.includes("ECONNRESET")
      ) {
        return true;
      }

      return false;
    },
  });

  redis.on("connect", () => {
    console.log("Redis connected successfully");
  });

  redis.on("ready", () => {
    console.log("Redis ready");
  });

  redis.on("error", (error) => {
    console.error("Redis error:", error.message);
  });

  redis.on("close", () => {
    console.warn("Redis connection closed");
  });

  redis.on("end", () => {
    console.warn("Redis connection ended");
  });
} else {
  console.warn("REDIS_URL missing. Redis cache disabled.");
}

module.exports = redis;
