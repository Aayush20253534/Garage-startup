const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("bulk price range deletion is validated and restricted to admins", () => {
  const routes = readProjectFile(
    "server/src/admin/routes/cityServicePriceRange.routes.js",
  );
  const validation = readProjectFile(
    "server/src/admin/validations/cityServicePriceRange.validation.js",
  );
  const controller = readProjectFile(
    "server/src/admin/controllers/cityServicePriceRange.controller.js",
  );

  assert.match(
    routes,
    /router\.delete\([\s\S]*"\/"[\s\S]*authorizeRoles\("ADMIN"\)[\s\S]*deletePriceRangesSchema[\s\S]*deletePriceRanges/,
  );
  assert.match(validation, /body\("priceRangeIds"\)/);
  assert.match(validation, /isArray\(\{ min: 1, max: 1000 \}\)/);
  assert.match(validation, /body\("priceRangeIds\.\*"\)[\s\S]*isUUID/);
  assert.match(validation, /payload\.deleteAll === true/);
  assert.match(validation, /body\("confirmation"\)/);
  assert.match(validation, /body\("password"\)/);
  assert.match(routes, /bulkDeleteStepUpRateLimit/);
  assert.match(controller, /deletePriceRanges\(req\.body, req\.user\)/);
});

test("bulk deletion clears matching or all records and invalidates pricing caches", () => {
  const service = readProjectFile(
    "server/src/admin/services/cityServicePriceRange.service.js",
  );
  const deleteStart = service.indexOf("const deletePriceRanges");
  const deleteSource = service.slice(deleteStart, service.indexOf("const scoreMatch"));

  assert.match(deleteSource, /cityServicePriceRange\.deleteMany/);
  assert.match(deleteSource, /deleteAll === true \? \{\} : \{ id: \{ in: uniqueIds \} \}/);
  assert.match(deleteSource, /invalidatePriceRangeCaches\(\)/);
  assert.match(deleteSource, /assertBulkDeleteStepUp/);
  assert.match(service, /argon2\.verify/);
  assert.match(service, /staffAccount\.findFirst/);
});

test("admin price ranges UI supports selected, shown, and global deletion", () => {
  const page = readProjectFile("client/src/pages/admin/Revenue.jsx");
  const api = readProjectFile("client/src/api/admin.js");

  assert.match(page, /selectedRangeIds/);
  assert.match(page, /Select all shown/);
  assert.match(page, /Delete selected/);
  assert.match(page, /DELETE ALL PRICE RANGES/);
  assert.match(page, /DELETE SELECTED/);
  assert.match(page, /Delete all cities/);
  assert.match(page, /bulkDeletePassword/);
  assert.match(page, /Verify and delete/);
  assert.match(api, /async deletePriceRanges\(/);
  assert.match(
    api,
    /data: \{ priceRangeIds, deleteAll, confirmation, password \}/,
  );
});

test("bulk deletion verifies the active admin password before deleting", async () => {
  const prismaPath = require.resolve("../../src/config/prisma");
  const cachePath = require.resolve("../../src/utils/cache");
  const argonPath = require.resolve("argon2");
  const servicePath = require.resolve(
    "../../src/admin/services/cityServicePriceRange.service",
  );
  const previousPrisma = require.cache[prismaPath];
  const previousCache = require.cache[cachePath];
  const previousArgon = require.cache[argonPath];
  const previousService = require.cache[servicePath];
  const liveRanges = [{ id: "range-1" }];
  let passwordChecks = 0;

  const prismaMock = {
    staffAccount: {
      async findFirst({ where }) {
        return where.id === "admin-1" && where.role === "ADMIN"
          ? { password: "stored-hash" }
          : null;
      },
    },
    cityServicePriceRange: {
      async findMany({ where }) {
        if (where.id?.in) {
          return liveRanges.filter((range) => where.id.in.includes(range.id));
        }
        return [...liveRanges];
      },
      async deleteMany({ where }) {
        const ids = where.id?.in || liveRanges.map((range) => range.id);
        const before = liveRanges.length;
        for (let index = liveRanges.length - 1; index >= 0; index -= 1) {
          if (ids.includes(liveRanges[index].id)) liveRanges.splice(index, 1);
        }
        return { count: before - liveRanges.length };
      },
    },
    priceRangeSubmission: {
      async deleteMany() {
        return { count: 0 };
      },
    },
    async $transaction(callback) {
      return callback(prismaMock);
    },
  };

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: prismaMock,
  };
  require.cache[cachePath] = {
    id: cachePath,
    filename: cachePath,
    loaded: true,
    exports: {
      async getCache() {
        return null;
      },
      async setCache() {},
      async deletePattern() {},
    },
  };
  require.cache[argonPath] = {
    id: argonPath,
    filename: argonPath,
    loaded: true,
    exports: {
      async verify(hash, password) {
        passwordChecks += 1;
        return hash === "stored-hash" && password === "correct-password";
      },
    },
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    const admin = { id: "admin-1", role: "ADMIN" };

    await assert.rejects(
      service.deletePriceRanges(
        {
          priceRangeIds: ["range-1"],
          confirmation: "DELETE SELECTED",
          password: "wrong-password",
        },
        admin,
      ),
      /password confirmation failed/,
    );
    assert.equal(liveRanges.length, 1);
    assert.equal(passwordChecks, 1);

    await assert.rejects(
      service.deletePriceRanges(
        {
          priceRangeIds: ["range-1"],
          confirmation: "DELETE SOMETHING",
          password: "correct-password",
        },
        admin,
      ),
      /Type DELETE SELECTED/,
    );
    assert.equal(passwordChecks, 1);
    assert.equal(liveRanges.length, 1);

    const result = await service.deletePriceRanges(
      {
        priceRangeIds: ["range-1"],
        confirmation: "DELETE SELECTED",
        password: "correct-password",
      },
      admin,
    );
    assert.equal(result.deleted, 1);
    assert.equal(liveRanges.length, 0);
    assert.equal(passwordChecks, 2);
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousCache) require.cache[cachePath] = previousCache;
    else delete require.cache[cachePath];
    if (previousArgon) require.cache[argonPath] = previousArgon;
    else delete require.cache[argonPath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
