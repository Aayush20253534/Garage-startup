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

test("garage applications require phone while email remains optional", () => {
  const schema = readServer("prisma/schema.prisma");
  const validation = readServer("src/garage/validations/application.validation.js");
  const stepOne = readClient("src/pages/garage/onboarding/Step1.jsx");
  const migration = readServer(
    "prisma/migrations/20260717130000_optional_garage_application_email/migration.sql",
  );

  assert.match(schema, /model GarageOwner[\s\S]*email\s+String\?[\s\S]*phone\s+String\s+@unique/);
  assert.match(schema, /model GarageApplication[\s\S]*email\s+String\?[\s\S]*phone\s+String/);
  assert.match(validation, /body\("email"\)[\s\S]*optional\(\{ nullable: true, checkFalsy: true \}\)/);
  assert.match(validation, /body\("phone"\)[\s\S]*\^\\\+91\[6-9\]\\d\{9\}\$/);
  assert.match(stepOne, /Email[\s\S]*\(Optional\)/);
  assert.match(stepOne, /pattern="\[6-9\]\[0-9\]\{9\}"/);
  assert.match(migration, /ALTER COLUMN "email" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "phone" SET NOT NULL/);
});

test("public garage GPS reverse geocoding does not require a login session", () => {
  const routes = readServer("src/routes/index.routes.js");
  const locationRoutes = readServer("src/customer/routes/location.routes.js");
  const addressClient = readClient("src/utils/address.js");
  const picker = readClient("src/components/maps/LocationPicker.jsx");

  assert.ok(
    routes.indexOf('router.use("/locations", locationRoutes)') <
      routes.indexOf("const requireCustomer"),
    "location router must be mounted before customer-only route groups",
  );
  assert.ok(
    locationRoutes.indexOf('"/reverse-geocode"') <
      locationRoutes.indexOf('router.use(protectUser, authorizeRoles("CUSTOMER"))'),
    "only reverse geocoding should be public",
  );
  assert.match(addressClient, /skipSessionExpiryMessage: true/);
  assert.match(picker, /resolveDraggedLocation\([\s\S]*"GPS"\)/);
});

test("garage identity checks never collide with customer or staff accounts", () => {
  const applicationService = readServer("src/garage/services/application.service.js");
  const authService = readServer("src/customer/services/auth.service.js");

  assert.match(applicationService, /prisma\.garageOwner\.findFirst/);
  assert.match(applicationService, /prisma\.garageApplication\.findFirst/);
  assert.match(applicationService, /prisma\.garage\.findFirst/);
  assert.doesNotMatch(applicationService, /prisma\.user\./);
  assert.match(applicationService, /normalizePhone\(payload\.phone\)/);
  assert.match(applicationService, /digits\.slice\(-10\)/);
  assert.match(applicationService, /passwordChangedAt: null/);
  assert.match(authService, /requestedRole === GARAGE_OWNER_ROLE[\s\S]*normalizePhone\(rawIdentifier\)/);
  assert.match(authService, /prisma\.garageOwner\.findFirst/);
});

test("admin status is compact and every PWA refreshes on a new build", () => {
  const garages = readClient("src/pages/admin/Garages.jsx");
  const workerRegistration = readClient("src/utils/imageCache.js");
  const vercel = readClient("vercel.json");
  const firebase = readClient("firebase.json");

  assert.match(garages, /label: "Pending review"/);
  assert.match(garages, /inline-flex w-fit shrink-0 self-start/);
  assert.match(workerRegistration, /getVersionedWorkerScriptUrl/);
  assert.match(workerRegistration, /__APP_BUILD_ID__/);
  assert.match(workerRegistration, /controllerchange/);
  for (const worker of ["sw.js", "garage-sw.js", "admin-sw.js", "intern-sw.js", "support-sw.js"]) {
    assert.match(workerRegistration, new RegExp(worker.replace(".", "\\.")));
  }
  assert.match(vercel, /display-capture=\(self\)/);
  assert.match(firebase, /display-capture=\(self\)/);
});
