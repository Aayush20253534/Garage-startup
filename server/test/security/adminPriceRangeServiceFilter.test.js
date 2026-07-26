const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("admin price ranges support service filtering across every result page", () => {
  const page = read("client/src/pages/admin/Revenue.jsx");
  const service = read(
    "server/src/admin/services/cityServicePriceRange.service.js",
  );
  const validation = read(
    "server/src/admin/validations/cityServicePriceRange.validation.js",
  );

  assert.match(page, /const \[filterServiceId, setFilterServiceId\]/);
  assert.match(page, /serviceId: filterServiceId/);
  assert.match(page, /aria-label="Filter price ranges by service"/);
  assert.match(service, /query\.serviceId && \{ serviceId: query\.serviceId \}/);
  assert.match(validation, /query\("serviceId"\).*isUUID\(\)/s);
});

test("configured vehicle options are loaded from all price ranges for the selected service", () => {
  const routes = read(
    "server/src/admin/routes/cityServicePriceRange.routes.js",
  );
  const controller = read(
    "server/src/admin/controllers/cityServicePriceRange.controller.js",
  );
  const service = read(
    "server/src/admin/services/cityServicePriceRange.service.js",
  );
  const api = read("client/src/api/admin.js");
  const page = read("client/src/pages/admin/Revenue.jsx");

  assert.match(routes, /"\/filter-options"/);
  assert.match(controller, /listPriceRangeFilterOptions/);
  assert.match(service, /buildPriceRangeVehicleFilterOptions/);
  assert.match(service, /serviceId: query\.serviceId/);
  assert.match(service, /vehicleBrand: true/);
  assert.match(service, /vehicleModel: true/);
  assert.match(api, /getPriceRangeFilterOptions/);
  assert.match(page, /getPriceRangeFilterOptions\(\{/);
  assert.match(page, /All configured brands/);
  assert.match(page, /All configured models/);
  assert.match(page, /Brand and model filters only show covered vehicle scopes/);
});
