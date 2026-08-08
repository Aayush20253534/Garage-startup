const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const {
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
} = require("../../src/utils/vehicleRegistration");
const {
  maskOwnerName,
  parseWay2ApiVehicle,
  parseWay2ApiAdminVehicle,
} = require("../../src/utils/way2apiRc");

test("registration numbers are normalized before RC verification", () => {
  assert.equal(normalizeRegistrationNumber("up-70 ab 1234"), "UP70AB1234");
  assert.equal(normalizeRegistrationNumber(" 22 bh 1234 aa "), "22BH1234AA");
  assert.equal(isValidRegistrationNumber("UP70AB1234"), true);
  assert.equal(isValidRegistrationNumber("@@@"), false);
});

test("legacy customers remain optional while newly created customers require registration", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260807160000_add_vehicle_registration_verification/migration.sql",
  );
  const auth = read("server/src/customer/services/auth.service.js");
  const vehicleService = read("server/src/customer/services/vehicle.service.js");
  const bookingService = read("server/src/customer/services/booking.service.js");
  const profilePage = read("client/src/pages/customer/Profile.jsx");

  assert.match(schema, /vehicleRegistrationRequired\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /vehicleRegistrationRequired[^;]+DEFAULT false/s);
  assert.match(auth, /vehicleRegistrationRequired:\s*pendingSignup\.role === "CUSTOMER"/);
  assert.match(auth, /vehicleRegistrationRequired:\s*userRole === "CUSTOMER"/);
  assert.match(vehicleService, /registrationRequired && !registrationNumber/);
  assert.match(bookingService, /vehicle\.user\?\.vehicleRegistrationRequired === true/);
  assert.match(bookingService, /!vehicle\.registrationNumber \|\| !vehicle\.registrationVerified/);
  assert.match(profilePage, /Your existing account can keep using saved vehicles without a registration number/);
  assert.match(profilePage, /to="\/dashboard\/vehicles"/);
});

test("Way2API stays server-side, uses bearer auth, and verification is rate limited", () => {
  const service = read(
    "server/src/customer/services/vehicleRegistration.service.js",
  );
  const env = read("server/src/config/env.js");
  const parser = read("server/src/utils/way2apiRc.js");
  const routes = read("server/src/customer/routes/vehicle.routes.js");
  const clientVerification = read(
    "client/src/components/vehicle/RegistrationVerificationField.jsx",
  );

  assert.match(service, /WAY2API_API_KEY/);
  assert.match(service, /https:\/\/app\.way2api\.com\/api\/v1\/rc\/verify/);
  assert.match(service, /Authorization:\s*`Bearer \$\{config\.apiKey\}`/);
  assert.match(service, /\{ rc_number: registrationNumber \}/);
  assert.match(service, /payload\.data\?\.result/);
  assert.match(parser, /maker_description/);
  assert.match(parser, /maker_model/);
  assert.match(env, /requireVariables\(\["WAY2API_API_KEY"\]\)/);
  assert.match(routes, /CUSTOMER_VEHICLE_DAILY_LIMIT = 3/);
  assert.match(routes, /CUSTOMER_VEHICLE_DAILY_WINDOW_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(routes, /name: "customer-vehicle-registration-daily"/);
  assert.match(routes, /name: "customer-vehicle-create-daily"/);
  assert.match(routes, /registrationChangeRateLimit/);
  assert.match(routes, /req\.body\?\.registrationNumber === undefined/);
  assert.match(clientVerification, /api\.post\("\/vehicles\/verify-registration"/);
  assert.doesNotMatch(clientVerification, /WAY2API_API_KEY/);
  assert.doesNotMatch(service, /MASTERS_INDIA_/);
});

test("Way2API keeps full RC owner server-side while preserving a masked customer-facing owner", () => {
  assert.equal(maskOwnerName("Vivek Kumar Singh"), "V***k K***r S***h");

  const mapped = parseWay2ApiVehicle({
    rc_number: "UP70AB1234",
    owner_name: "Vivek Kumar Singh",
    maker_description: "MARUTI SUZUKI INDIA LTD",
    maker_model: "BALENO DELTA",
    fuel_type: "PETROL",
    vehicle_category: "LMV",
    rc_status: "ACTIVE",
    registration_date: "2024-01-12",
    insurance_upto: "2027-01-11",
    present_address: "must never be mapped",
    vehicle_chasi_number: "must never be mapped",
    vehicle_engine_number: "must never be mapped",
  });

  assert.equal(mapped.registrationNumber, "UP70AB1234");
  assert.equal(mapped.ownerName, "Vivek Kumar Singh");
  assert.equal(mapped.ownerNameMasked, "V***k K***r S***h");
  assert.equal(mapped.maker, "MARUTI SUZUKI INDIA LTD");
  assert.equal(mapped.model, "BALENO DELTA");
  assert.equal(mapped.fuelType, "PETROL");
  assert.equal(Object.hasOwn(mapped, "presentAddress"), false);
  assert.equal(Object.hasOwn(mapped, "chassisNumber"), false);
  assert.equal(Object.hasOwn(mapped, "engineNumber"), false);

  const adminMapped = parseWay2ApiAdminVehicle({
    rc_number: "UP70AB1234",
    owner_name: "Vivek Kumar Singh",
    maker_description: "MARUTI SUZUKI INDIA LTD",
    maker_model: "BALENO DELTA",
    fuel_type: "PETROL",
    present_address: "must never be mapped",
    vehicle_chasi_number: "must never be mapped",
  });
  assert.equal(adminMapped.ownerName, "Vivek Kumar Singh");
  assert.equal(Object.hasOwn(adminMapped, "presentAddress"), false);
  assert.equal(Object.hasOwn(adminMapped, "chassisNumber"), false);
});

test("admin and intern portals expose a read-only vehicle registry", () => {
  const app = read("client/src/App.jsx");
  const adminPage = read("client/src/pages/admin/Vehicles.jsx");
  const adminRoutes = read("server/src/admin/routes/adminOperations.routes.js");
  const adminService = read("server/src/admin/services/adminOperations.service.js");

  assert.match(app, /to: "\/admin\/vehicles", label: "Vehicles"/);
  assert.match(app, /to: "\/intern\/vehicles", label: "Vehicles"/);
  assert.match(adminRoutes, /"\/vehicles"[\s\S]{0,120}controller\.listVehicles/);
  assert.match(adminService, /vehicleRegistrationRequired: true/);
  assert.match(adminPage, /Registered name/);
  assert.match(adminPage, /Vehicle no\./);
  assert.match(adminPage, /RC verified/);
});

test("admin RC lookup calls Way2API instead of resolving customer phone from Rovauto", () => {
  const adminApi = read("client/src/api/admin.js");
  const adminPage = read("client/src/pages/admin/Vehicles.jsx");
  const adminRoutes = read("server/src/admin/routes/adminOperations.routes.js");
  const adminService = read("server/src/admin/services/adminOperations.service.js");
  const registrationService = read(
    "server/src/customer/services/vehicleRegistration.service.js",
  );

  assert.match(adminApi, /lookupVehicleRegistration/);
  assert.match(adminPage, /Live RC lookup/);
  assert.match(adminPage, /Live Way2API match/);
  assert.match(adminPage, /Not supplied by Way2API/);
  assert.match(adminRoutes, /admin-way2api-vehicle-rc-lookup/);
  assert.match(adminRoutes, /authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(adminService, /lookupRegistrationForAdmin/);
  assert.doesNotMatch(adminService, /where: \{ registrationNumber: normalizedRegistration \}/);
  assert.match(registrationService, /requestProvider\(normalized, \{ adminView: true \}\)/);
  assert.match(adminService, /data: \{ rcOwnerName: result\.vehicle\.ownerName \}/);
  assert.match(adminService, /rcOwnerName: true/);
  assert.match(adminPage, /vehicle\.rcOwnerName/);
  assert.match(adminPage, /queryClient\.invalidateQueries\(\{ queryKey: \["admin", "vehicles"\] \}\)/);
  assert.match(registrationService, /rcOwnerName: verification\.vehicle\?\.ownerName \|\| null/);
  assert.match(adminService, /registeredPhone: null/);
});
