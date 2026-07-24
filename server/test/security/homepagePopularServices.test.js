const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("popular home services are persisted and admin-only", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260724093000_add_homepage_popular_services/migration.sql",
  );
  const routes = read("server/src/admin/routes/serviceAdmin.routes.js");
  const validation = read(
    "server/src/admin/validations/serviceAdmin.validation.js",
  );
  const service = read("server/src/admin/services/serviceAdmin.service.js");

  assert.match(schema, /isPopular\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /popularOrder\s+Int\?/);
  assert.match(migration, /ranked_services[\s\S]*position <= 6/);
  assert.match(
    routes,
    /"\/popular"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)[\s\S]*updatePopularServicesSchema/,
  );
  assert.match(validation, /body\("serviceIds"\)[\s\S]*isArray\(\{ max: 6 \}\)/);
  assert.match(service, /const setPopularServices/);
  assert.match(service, /isPopular: true, popularOrder: index \+ 1/);
  assert.match(service, /must be active in an active category/);
});

test("admin can select and order the popular services shown on home", () => {
  const api = read("client/src/api/admin.js");
  const adminPage = read("client/src/pages/admin/Services.jsx");
  const home = read("client/src/pages/Home.jsx");

  assert.match(api, /updatePopularServices\(serviceIds\)/);
  assert.match(adminPage, /Popular Vehicle Services/);
  assert.match(adminPage, /Add to home/);
  assert.match(adminPage, /movePopularService/);
  assert.match(adminPage, /Save home services/);
  assert.match(home, /filter\(\(service\) => toBoolean\(service\.isPopular\)\)/);
  assert.match(home, /popularOrder/);
});

test("price range list reports and displays the database total", () => {
  const service = read(
    "server/src/admin/services/cityServicePriceRange.service.js",
  );
  const page = read("client/src/pages/admin/Revenue.jsx");

  assert.match(service, /cityServicePriceRange\.count\(\{ where: filterWhere \}\)/);
  assert.match(service, /items,[\s\S]*total,[\s\S]*nextCursor/);
  assert.match(page, /Total price ranges: \{totalRangeCount\}/);
  assert.match(page, /Showing \{ranges\.length\} of \{totalRangeCount\}/);
});

test("popular service selection is replaced atomically in the requested order", async () => {
  const prismaPath = require.resolve("../../src/config/prisma");
  const cachePath = require.resolve("../../src/utils/cache");
  const cloudinaryPath = require.resolve("../../src/utils/cloudinaryUpload");
  const servicePath = require.resolve(
    "../../src/admin/services/serviceAdmin.service",
  );
  const previousPrisma = require.cache[prismaPath];
  const previousCache = require.cache[cachePath];
  const previousCloudinary = require.cache[cloudinaryPath];
  const previousService = require.cache[servicePath];
  const records = new Map([
    [
      "service-1",
      {
        id: "service-1",
        name: "PDI",
        isActive: true,
        category: { name: "Inspection", isActive: true },
      },
    ],
    [
      "service-2",
      {
        id: "service-2",
        name: "Car Wash",
        isActive: true,
        category: { name: "Cleaning", isActive: true },
      },
    ],
  ]);
  const writes = [];

  const prismaMock = {
    service: {
      async findMany({ where, select, orderBy }) {
        const rows = (where?.id?.in || []).map((id) => records.get(id)).filter(Boolean);
        if (select) return rows;
        if (orderBy) {
          return rows
            .map((row) => ({ ...row }))
            .sort((left, right) => left.popularOrder - right.popularOrder);
        }
        return rows;
      },
    },
    async $transaction(callback) {
      return callback({
        service: {
          async updateMany({ data }) {
            writes.push({ type: "clear", data });
            for (const record of records.values()) {
              record.isPopular = false;
              record.popularOrder = null;
            }
          },
          async update({ where, data }) {
            writes.push({ type: "set", id: where.id, data });
            Object.assign(records.get(where.id), data);
          },
        },
      });
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
    exports: { deletePattern: async () => {} },
  };
  require.cache[cloudinaryPath] = {
    id: cloudinaryPath,
    filename: cloudinaryPath,
    loaded: true,
    exports: {
      deleteFromCloudinary: async () => {},
      uploadToCloudinary: async () => ({}),
    },
  };
  delete require.cache[servicePath];

  try {
    const service = require(servicePath);
    await service.setPopularServices(["service-2", "service-1"]);

    assert.deepEqual(writes, [
      {
        type: "clear",
        data: { isPopular: false, popularOrder: null },
      },
      {
        type: "set",
        id: "service-2",
        data: { isPopular: true, popularOrder: 1 },
      },
      {
        type: "set",
        id: "service-1",
        data: { isPopular: true, popularOrder: 2 },
      },
    ]);
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousCache) require.cache[cachePath] = previousCache;
    else delete require.cache[cachePath];
    if (previousCloudinary) require.cache[cloudinaryPath] = previousCloudinary;
    else delete require.cache[cloudinaryPath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
