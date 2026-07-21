const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||=
  "postgresql://test:test@127.0.0.1:5432/rovauto_test";

const prismaPath = require.resolve("../../src/config/prisma");
const fs = require("node:fs");
const path = require("node:path");

require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {},
};

const {
  buildCategoryAvailabilityWhere,
  buildServiceAvailabilityWhere,
  normalizeRestrictedCityIds,
} = require("../../src/services/serviceCityRestriction.service");

test("anonymous or city-less catalogue requests are not city filtered", () => {
  assert.deepEqual(buildCategoryAvailabilityWhere(), {});
  assert.deepEqual(buildCategoryAvailabilityWhere(""), {});
  assert.deepEqual(buildServiceAvailabilityWhere(), {});
  assert.deepEqual(buildServiceAvailabilityWhere(""), {});
});

test("authenticated city catalogue excludes categories restricted in that city", () => {
  assert.deepEqual(buildCategoryAvailabilityWhere("city-1"), {
    cityRestrictions: {
      none: {
        cityId: "city-1",
      },
    },
  });
});

test("authenticated city catalogue excludes direct and category-level service restrictions", () => {
  assert.deepEqual(buildServiceAvailabilityWhere("city-1"), {
    cityRestrictions: {
      none: {
        cityId: "city-1",
      },
    },
    category: {
      cityRestrictions: {
        none: {
          cityId: "city-1",
        },
      },
    },
  });
});

test("restricted city IDs are trimmed, deduplicated, and empty values removed", () => {
  assert.deepEqual(
    normalizeRestrictedCityIds([" city-1 ", "city-2", "city-1", null, ""]),
    ["city-1", "city-2"],
  );
});

test("admin services provide a focused coverage editor", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../../client/src/pages/admin/Services.jsx"),
    "utf8",
  );

  assert.match(source, /Edit coverage/);
  assert.match(source, /openCoverageEditor\(service\)/);
  assert.match(source, /description: coverageItems\.join\(", "\) \|\| null/);
  assert.match(source, /Save coverage/);
  assert.match(source, /Enter one coverage item per line/);
});
