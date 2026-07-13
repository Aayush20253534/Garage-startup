const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.DATABASE_URL ||=
  "postgresql://test:test@127.0.0.1:5432/rovauto_test";

const prismaPath = require.resolve("../../src/config/prisma");
const cachePath = require.resolve("../../src/utils/cache");
const publicServicePath = require.resolve("../../src/services/public.service");
const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

let garageAggregate = {
  _count: { _all: 3 },
  _avg: { ratingAvg: 4.2 },
};
let cachedValue = null;
let cachedWrite = null;
let aggregateArgs = null;

require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    garage: {
      aggregate: async (args) => {
        aggregateArgs = args;
        return garageAggregate;
      },
    },
    user: {
      count: async () => 12,
    },
  },
};

require.cache[cachePath] = {
  id: cachePath,
  filename: cachePath,
  loaded: true,
  exports: {
    getCache: async () => cachedValue,
    setCache: async (key, value, ttlSeconds) => {
      cachedWrite = { key, value, ttlSeconds };
    },
  },
};

delete require.cache[publicServicePath];
const publicService = require(publicServicePath);

test("public stats return the average rating of all verified active garages", async () => {
  cachedValue = null;
  cachedWrite = null;
  aggregateArgs = null;
  garageAggregate = {
    _count: { _all: 3 },
    _avg: { ratingAvg: 4.2 },
  };

  const stats = await publicService.getStats();

  assert.deepEqual(aggregateArgs, {
    where: {
      isVerified: true,
      isActive: true,
    },
    _count: { _all: true },
    _avg: { ratingAvg: true },
  });
  assert.deepEqual(stats, {
    garages: 3,
    customers: 12,
    averageRating: 4.2,
  });
  assert.equal(cachedWrite.key, "public:stats:v2");
  assert.deepEqual(cachedWrite.value, stats);
});

test("public stats return zero average rating when no garages are available", async () => {
  cachedValue = null;
  cachedWrite = null;
  garageAggregate = {
    _count: { _all: 0 },
    _avg: { ratingAvg: null },
  };

  const stats = await publicService.getStats();

  assert.equal(stats.garages, 0);
  assert.equal(stats.averageRating, 0);
});

test("homepage renders the API average instead of a hardcoded rating", () => {
  const homePage = read("client/src/pages/Home.jsx");

  assert.doesNotMatch(homePage, /4\.8★/);
  assert.match(
    homePage,
    /averageRating:\s*formatAverageRating\(stats\.averageRating\)/,
  );
  assert.match(homePage, /\[partnerStats\.averageRating, "Avg rating"\]/);
});

test("review changes invalidate the public homepage stats cache", () => {
  const reviewService = read(
    "server/src/customer/services/review.service.js",
  );

  assert.match(reviewService, /deleteCache\("public:stats:v2"\)/);
});
