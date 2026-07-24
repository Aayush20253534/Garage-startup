const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("city discount is persisted, admin-managed, and applied to booking ranges", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260724133000_add_city_price_discounts/migration.sql",
  );
  const routes = read("server/src/admin/routes/cityServicePriceRange.routes.js");
  const discountService = read("server/src/admin/services/cityPriceDiscount.service.js");
  const priceService = read("server/src/admin/services/cityServicePriceRange.service.js");
  const customerService = read("server/src/customer/services/service.service.js");

  assert.match(schema, /model CityPriceDiscount/);
  assert.match(schema, /discountPercent\s+Int/);
  assert.match(migration, /city_price_discounts_percent_check/);
  assert.match(
    routes,
    /"\/city-discounts"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(discountService, /applyCityDiscountToRange/);
  assert.match(discountService, /\(100 - percent\) \/ 100/);
  assert.match(priceService, /getActiveCityPriceDiscount/);
  assert.match(priceService, /applyCityDiscountToRange/);
  assert.match(customerService, /regularPriceRange/);
  assert.match(customerService, /discountPercent/);
});

test("customer UI shows a larger red crossed-out regular price", () => {
  const component = read(
    "client/src/components/services/ServicePriceDisplay.jsx",
  );
  const revenue = read("client/src/pages/admin/Revenue.jsx");
  const home = read("client/src/pages/Home.jsx");
  const category = read("client/src/pages/CategoryDetail.jsx");
  const serviceSelect = read("client/src/pages/booking/ServiceSelect.jsx");
  const checkout = read("client/src/pages/booking/Checkout.jsx");

  assert.match(component, /regularPriceRange/);
  assert.match(component, /text-red-600 line-through decoration-2/);
  assert.match(component, /discountPercent}% off/);
  assert.match(revenue, /City discount/);
  assert.match(revenue, /real stored regular price/);
  assert.match(home, /ServicePriceDisplay/);
  assert.match(category, /ServicePriceDisplay/);
  assert.match(serviceSelect, /ServicePriceDisplay/);
  assert.match(checkout, /ServicePriceDisplay/);
});

test("discount math lowers actual prices and preserves regular prices", async () => {
  const prismaPath = require.resolve("../../src/config/prisma");
  const cachePath = require.resolve("../../src/utils/cache");
  const servicePath = require.resolve(
    "../../src/admin/services/cityPriceDiscount.service",
  );
  const previousPrisma = require.cache[prismaPath];
  const previousCache = require.cache[cachePath];
  const previousService = require.cache[servicePath];

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {},
  };
  require.cache[cachePath] = {
    id: cachePath,
    filename: cachePath,
    loaded: true,
    exports: {
      getCache: async () => null,
      setCache: async () => true,
      deletePattern: async () => true,
    },
  };
  delete require.cache[servicePath];

  try {
    const { applyCityDiscountToRange } = require(servicePath);
    const result = applyCityDiscountToRange(
      { id: "range-1", minPrice: 1000, maxPrice: 2000 },
      {
        id: "discount-1",
        cityId: "city-1",
        discountPercent: 5,
        isActive: true,
      },
    );

    assert.equal(result.regularMinPrice, 1000);
    assert.equal(result.regularMaxPrice, 2000);
    assert.equal(result.minPrice, 950);
    assert.equal(result.maxPrice, 1900);
    assert.equal(result.discountPercent, 5);
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousCache) require.cache[cachePath] = previousCache;
    else delete require.cache[cachePath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
