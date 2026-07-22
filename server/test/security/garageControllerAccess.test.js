const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("garage controllers use isolated identities, sessions, and email recovery", () => {
  const schema = read("server/prisma/schema.prisma");
  const auth = read("server/src/customer/services/auth.service.js");
  const middleware = read("server/src/middlewares/auth.middleware.js");

  assert.match(schema, /model GarageController \{/);
  assert.match(schema, /model GarageControllerSession \{/);
  assert.match(schema, /email\s+String\s+@unique/);
  assert.match(schema, /phone\s+String\s+@unique/);
  assert.match(auth, /GARAGE_CONTROLLER_ROLE/);
  assert.match(auth, /requestPasswordReset/);
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
  assert.match(adminRoutes, /authorizeRoles\("ADMIN"\)/);
  assert.match(adminRoutes, /setLimit/);
});
