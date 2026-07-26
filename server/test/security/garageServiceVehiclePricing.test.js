const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("garage service endpoint applies vehicle filters and contextual city pricing", () => {
  const controller = readProjectFile(
    "server/src/controllers/garage.controller.js",
  );
  const service = readProjectFile(
    "server/src/garage/services/garageOwner.service.js",
  );

  assert.match(controller, /getGarageOwnerServices\(\s*ownerId,\s*req\.query \|\| \{\}/);
  assert.match(service, /filters\.vehicleBrand/);
  assert.match(service, /filters\.vehicleModel/);
  assert.match(service, /filters\.fuelType/);
  assert.match(service, /garageSupportsVehicleBrand\(garage, vehicle\)/);
  assert.match(service, /serviceMatchesVehicleFilter\(serviceAssignments, vehicle\)/);
  assert.match(
    service,
    /cityServicePriceRangeService\.findBestPriceRangesForBooking\(\{/,
  );
  assert.match(service, /city: garage\.city/);
  assert.match(service, /pricingStatus: "AVAILABLE"/);
  assert.match(service, /pricingStatus: "NOT_ALLOCATED"/);
});

test("garage services UI filters catered vehicles and never invents a zero price", () => {
  const page = readProjectFile("client/src/pages/garage/Services.jsx");

  assert.match(page, /Vehicle coverage filter/);
  assert.match(page, /vehicleBrand: selectedBrand/);
  assert.match(page, /vehicleModel: selectedModel/);
  assert.match(page, /fuelType: selectedFuelType/);
  assert.match(page, /Customer price range/);
  assert.match(page, /formatRupeeRange\(/);
  assert.match(page, /"Not allocated"/);
  assert.doesNotMatch(page, /formatServicePriceRange/);
  assert.doesNotMatch(page, /₹0\s*-\s*₹500/);
});

test("garage activation state uses a rectangular status label", () => {
  const profile = readProjectFile("client/src/pages/garage/Profile.jsx");
  const statusBlock = profile.slice(
    profile.indexOf('className={['),
    profile.indexOf("Activation Pending") + "Activation Pending".length,
  );

  assert.match(statusBlock, /rounded-md/);
  assert.doesNotMatch(statusBlock, /rounded-full/);
});
