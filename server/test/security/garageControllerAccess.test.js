const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("garage controllers use phone-first identities, isolated sessions, and optional email recovery", () => {
  const schema = read("server/prisma/schema.prisma");
  const auth = read("server/src/customer/services/auth.service.js");
  const middleware = read("server/src/middlewares/auth.middleware.js");
  const controllerService = read("server/src/garage/services/controller.service.js");
  const controllerValidation = read("server/src/garage/validations/controller.validation.js");
  const migration = read(
    "server/prisma/migrations/20260731153000_make_garage_controller_email_optional/migration.sql",
  );

  assert.match(schema, /model GarageController \{/);
  assert.match(schema, /model GarageControllerSession \{/);
  assert.match(schema, /email\s+String\?\s+@unique/);
  assert.match(schema, /phone\s+String\s+@unique/);
  assert.match(auth, /GARAGE_CONTROLLER_ROLE/);
  assert.match(auth, /requestPasswordReset/);
  assert.match(auth, /\.\.\.\(cleanPhone \? \[\{ phone: cleanPhone \}\] : \[\]\)/);
  assert.match(controllerService, /Name and phone are required/);
  assert.match(controllerService, /return email \|\| null/);
  assert.match(controllerValidation, /body\("email"\)[\s\S]*optional\(\{ checkFalsy: true \}\)/);
  assert.match(migration, /ALTER COLUMN "email" DROP NOT NULL/);
  assert.match(middleware, /getActiveGarageControllerSession/);
});

test("only available controllers receive offers and the first acceptance is atomic", () => {
  const requests = read("server/src/services/garageRequest.service.js");
  const controllerService = read("server/src/garage/services/controller.service.js");

  assert.match(controllerService, /availability: "AVAILABLE"/);
  assert.match(requests, /availableControllers\.length/);
  assert.match(requests, /to: controller\.phone/);
  assert.match(requests, /garageControllerDispatch\.findFirst/);
  assert.match(requests, /availability: "BUSY"/);
  assert.match(requests, /garageControllerId: controllerId/);
  assert.match(requests, /bookingClaim\.count === 0/);
  assert.match(requests, /whatsapp_fallback/);
});

test("controller history hides other customers and management remains owner or admin only", () => {
  const service = read("server/src/garage/services/controller.service.js");
  const ownerRoutes = read("server/src/garage/routes/controllerManagement.routes.js");
  const adminRoutes = read("server/src/admin/routes/garageController.routes.js");

  assert.match(service, /phone: null, email: null/);
  assert.match(service, /customerAddress: own \? booking\.customerAddress : null/);
  assert.match(service, /status: \{ in: TERMINAL_BOOKING_STATUSES \}/);
  assert.match(ownerRoutes, /authorizeRoles\("GARAGE_OWNER"\)/);
  assert.match(adminRoutes, /authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(adminRoutes, /setLimit/);
});


test("controller management tolerates body-less requests and uses structured card UI", () => {
  const controller = read("server/src/garage/controllers/controller.controller.js");
  const validation = read("server/src/garage/validations/controller.validation.js");
  const managementUi = read("client/src/components/garage/ControllerManagement.jsx");
  const dashboardUi = read("client/src/pages/garage/ControllerDashboard.jsx");

  assert.match(controller, /const requestSection = \(req, key\)/);
  assert.match(controller, /return params\.garageId \|\| query\.garageId \|\| body\.garageId \|\| null/);
  assert.match(controller, /const requestBody = \(req\) => requestSection\(req, "body"\)/);
  assert.match(controller, /transferBooking\(req\.user, requestedGarageId\(req\)/);
  assert.match(validation, /body\("garageId"\)\.optional\(\)\.isUUID\(\)/);
  assert.doesNotMatch(managementUi, /rounded-(?:full|2xl|3xl)/);
  assert.doesNotMatch(dashboardUi, /rounded-(?:full|2xl|3xl)/);
  assert.match(managementUi, /Controller accounts/);
  assert.match(managementUi, /grid gap-4 md:grid-cols-2 xl:grid-cols-3/);
  assert.match(dashboardUi, /Combined garage history/);
});
