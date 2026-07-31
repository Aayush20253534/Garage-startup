const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("clear all bookings reports inspection Cloudinary assets without an undefined identifier", () => {
  const service = readProjectFile(
    "server/src/admin/services/adminOperations.service.js",
  );

  const helperStart = service.indexOf(
    "const deleteInspectionMediaFromCloudinary",
  );
  const helperEnd = service.indexOf("const clearAllBookings", helperStart);
  const helperSource = service.slice(helperStart, helperEnd);

  assert.ok(helperStart >= 0, "inspection media cleanup helper must exist");
  assert.match(helperSource, /requested:\s*uniqueAssets\.length/);
  assert.doesNotMatch(helperSource, /uniquePublicIds/);
});

test("clear all bookings is restricted to the main admin role", () => {
  const routes = readProjectFile(
    "server/src/admin/routes/adminOperations.routes.js",
  );

  const routeStart = routes.indexOf('router.delete(\n  "/bookings/all"');
  const routeEnd = routes.indexOf(");", routeStart) + 2;
  const routeSource = routes.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0, "clear all bookings route must exist");
  assert.match(routeSource, /authorizeRoles\("ADMIN"\)/);
  assert.doesNotMatch(routeSource, /SUB_ADMIN/);
});

test("clear all bookings only collects booking inspection media for Cloudinary cleanup", () => {
  const service = readProjectFile(
    "server/src/admin/services/adminOperations.service.js",
  );

  const clearStart = service.indexOf("const clearAllBookings");
  const clearEnd = service.indexOf("module.exports", clearStart);
  const clearSource = service.slice(clearStart, clearEnd);

  assert.match(clearSource, /prisma\.bookingInspectionImage\.findMany/);
  assert.doesNotMatch(clearSource, /prisma\.garageImage\.findMany/);
  assert.doesNotMatch(clearSource, /prisma\.vehicleBrand\.findMany/);
  assert.doesNotMatch(clearSource, /prisma\.vehicleModel\.findMany/);
});
