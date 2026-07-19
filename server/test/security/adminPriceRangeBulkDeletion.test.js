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

  assert.match(
    routes,
    /router\.delete\([\s\S]*"\/"[\s\S]*authorizeRoles\("ADMIN"\)[\s\S]*deletePriceRangesSchema[\s\S]*deletePriceRanges/,
  );
  assert.match(validation, /body\("priceRangeIds"\)/);
  assert.match(validation, /isArray\(\{ min: 1, max: 1000 \}\)/);
  assert.match(validation, /body\("priceRangeIds\.\*"\)[\s\S]*isUUID/);
  assert.match(validation, /payload\.deleteAll === true/);
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
});

test("admin price ranges UI supports selected, shown, and global deletion", () => {
  const page = readProjectFile("client/src/pages/admin/Revenue.jsx");
  const api = readProjectFile("client/src/api/admin.js");

  assert.match(page, /selectedRangeIds/);
  assert.match(page, /Select all shown/);
  assert.match(page, /Delete selected/);
  assert.match(page, /DELETE ALL PRICE RANGES/);
  assert.match(page, /Delete all cities/);
  assert.match(api, /deletePriceRanges\(priceRangeIds = \[\], deleteAll = false\)/);
  assert.match(api, /data: \{ priceRangeIds, deleteAll \}/);
});
