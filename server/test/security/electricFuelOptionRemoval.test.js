const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serverRoot = path.resolve(__dirname, "../..");
const clientRoot = path.resolve(serverRoot, "../client");
const readServer = (relativePath) =>
  fs.readFileSync(path.join(serverRoot, relativePath), "utf8");
const readClient = (relativePath) =>
  fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("electric is not offered or accepted as a new fuel option", () => {
  const vehicleOptions = readClient("src/data/vehicles.js");
  const priceRangePage = readClient("src/pages/admin/Revenue.jsx");
  const vehicleValidation = readServer(
    "src/customer/validations/vehicle.validation.js",
  );
  const onboardingValidation = readServer(
    "src/customer/validations/customer.validation.js",
  );
  const priceRangeValidation = readServer(
    "src/admin/validations/cityServicePriceRange.validation.js",
  );
  const fuelTypeConstants = readServer("src/constants/fuelTypes.js");

  for (const source of [
    vehicleOptions,
    priceRangePage,
    vehicleValidation,
    onboardingValidation,
    priceRangeValidation,
    fuelTypeConstants,
  ]) {
    assert.doesNotMatch(source, /ELECTRIC|label:\s*["']Electric["']/);
  }
});

test("the legacy database enum remains deployable for existing records", () => {
  const schema = readServer("prisma/schema.prisma");

  assert.match(schema, /enum FuelType \{[\s\S]*ELECTRIC[\s\S]*\}/);
});
