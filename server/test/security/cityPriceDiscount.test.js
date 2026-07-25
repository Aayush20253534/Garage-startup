const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("city reference markup is persisted and attached to customer price ranges", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260724133000_add_city_price_discounts/migration.sql",
  );
  const routes = read("server/src/admin/routes/cityServicePriceRange.routes.js");
  const displayRuleService = read(
    "server/src/admin/services/cityPriceDiscount.service.js",
  );
  const priceService = read(
    "server/src/admin/services/cityServicePriceRange.service.js",
  );
  const customerService = read(
    "server/src/customer/services/service.service.js",
  );

  assert.match(schema, /model CityPriceDiscount/);
  assert.match(schema, /discountPercent\s+Int/);
  assert.match(migration, /city_price_discounts_percent_check/);
  assert.match(
    routes,
    /"\/city-discounts"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(displayRuleService, /\(100 \+ percent\) \/ 100/);
  assert.match(displayRuleService, /referenceMinPrice/);
  assert.match(displayRuleService, /referenceMarkupPercent/);
  assert.match(priceService, /getActiveCityPriceDiscount/);
  assert.match(priceService, /applyCityDiscountToRange/);
  assert.match(customerService, /compareAtPriceRange/);
  assert.match(customerService, /referenceMarkupPercent/);
});

test("customer UI shows the comparison as a red crossed price without extra labels", () => {
  const component = read(
    "client/src/components/services/ServicePriceDisplay.jsx",
  );
  const revenue = read("client/src/pages/admin/Revenue.jsx");
  const home = read("client/src/pages/Home.jsx");
  const category = read("client/src/pages/CategoryDetail.jsx");
  const serviceSelect = read("client/src/pages/booking/ServiceSelect.jsx");
  const checkout = read("client/src/pages/booking/Checkout.jsx");

  assert.match(component, /compareAtPriceRange/);
  assert.match(component, /text-red-500 line-through/);
  assert.match(component, /decoration-red-500/);
  assert.doesNotMatch(component, /Reference \+\{referenceMarkupPercent\}%/);
  assert.doesNotMatch(component, /Rovauto price/);
  assert.doesNotMatch(component, /% off/);
  assert.match(revenue, /crossed comparison range/);
  assert.match(revenue, /without extra labels/);
  assert.match(home, /ServicePriceDisplay/);
  assert.match(category, /ServicePriceDisplay/);
  assert.match(serviceSelect, /ServicePriceDisplay/);
  assert.match(checkout, /ServicePriceDisplay/);
});

test("reference markup raises only the display comparison and preserves booking prices", async () => {
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
        id: "display-rule-1",
        cityId: "city-1",
        discountPercent: 5,
        isActive: true,
      },
    );

    assert.equal(result.minPrice, 1000);
    assert.equal(result.maxPrice, 2000);
    assert.equal(result.referenceMinPrice, 1050);
    assert.equal(result.referenceMaxPrice, 2100);
    assert.equal(result.referenceMarkupPercent, 5);
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousCache) require.cache[cachePath] = previousCache;
    else delete require.cache[cachePath];
    if (previousService) require.cache[servicePath] = previousService;
    else delete require.cache[servicePath];
  }
});
