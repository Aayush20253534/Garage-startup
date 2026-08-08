const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("comparison prices use the red crossed-price treatment everywhere", () => {
  const files = [
    "client/src/components/services/ServicePriceDisplay.jsx",
    "client/src/pages/Home.jsx",
    "client/src/pages/CategoryDetail.jsx",
    "client/src/pages/booking/ServiceSelect.jsx",
    "client/src/pages/booking/Checkout.jsx",
    "client/src/pages/admin/Revenue.jsx",
  ];

  files.forEach((file) => {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /text-gray-400 line-through decoration-\[1\.5px\] decoration-gray-400/,
      `${file} still contains the old grey comparison price`,
    );
  });
  assert.match(read(files[0]), /text-red-500 line-through/);
});

test("admin preview and blocked garage status use stable rectangular layouts", () => {
  const revenue = read("client/src/pages/admin/Revenue.jsx");
  const controlCenter = read("client/src/pages/admin/ControlCenter.jsx");

  assert.match(revenue, /relative h-40 overflow-hidden/);
  assert.match(revenue, /mt-auto inline-flex w-fit/);
  assert.match(controlCenter, /PERMANENTLY_BLOCKED/);
  assert.match(controlCenter, /rounded-none border-l-4/);
  assert.match(controlCenter, /flex min-w-\[640px\] items-center gap-2/);
});

test("pricing control shows untouched services and exact brand, model, and fuel gaps", () => {
  const controlCenter = read("client/src/pages/admin/ControlCenter.jsx");
  const revenue = read("client/src/pages/admin/Revenue.jsx");
  const vehicleData = read("client/src/data/vehicles.js");
  const validation = read(
    "server/src/admin/validations/cityServicePriceRange.validation.js",
  );

  assert.match(controlCenter, /Untouched services/);
  assert.match(controlCenter, /Remaining brand and fuel coverage/);
  assert.match(controlCenter, /Remaining model and fuel coverage/);
  assert.match(controlCenter, /coverageFilters\.vehicleBrand/);
  assert.match(controlCenter, /coverageFilters\.fuelType/);
  assert.match(controlCenter, /modelResultsTruncated/);
  assert.match(controlCenter, /Registered vehicle fuel combinations/);
  assert.doesNotMatch(revenue, /"ELECTRIC"/);
  assert.doesNotMatch(vehicleData, /Electric|ELECTRIC/);
  assert.doesNotMatch(validation, /"ELECTRIC"/);
});
