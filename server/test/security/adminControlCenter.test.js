const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("the admin control center supports main and sub-admin operations", () => {
  const routes = read("server/src/admin/routes/adminControlCenter.routes.js");
  const indexRoutes = read("server/src/routes/index.routes.js");
  const app = read("client/src/App.jsx");
  const page = read("client/src/pages/admin/ControlCenter.jsx");

  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /router\.use\(authorizeRoles\("ADMIN", "SUB_ADMIN"\)\)/);
  assert.match(indexRoutes, /"\/admin\/control-center"/);
  assert.match(app, /path="\/admin\/control-center"/);
  assert.match(page, /Admin Control Center/);
  assert.match(page, /Booking Support/);
  assert.match(page, /Garage Performance/);
  assert.match(page, /Pricing Control/);
  assert.match(page, /Availability/);
  assert.match(page, /Audit Logs/);
});

test("admin mutations are audit logged with sanitized request metadata", () => {
  const middleware = read("server/src/admin/middlewares/adminAudit.middleware.js");
  const service = read("server/src/admin/services/adminAudit.service.js");
  const indexRoutes = read("server/src/routes/index.routes.js");

  assert.match(middleware, /res\.on\("finish"/);
  assert.match(indexRoutes, /router\.use\(adminAuditMiddleware\)/);
  assert.match(service, /MUTATING_METHODS/);
  assert.match(service, /req\.originalUrl/);
  assert.match(service, /actor\?\.accountType === "STAFF"/);
  assert.match(service, /\["ADMIN", "SUB_ADMIN", "INTERN"\]/);
  assert.match(service, /SENSITIVE_KEYS/);
  assert.match(service, /"\[redacted\]"/);
  assert.match(service, /prisma\.adminAuditLog\.create/);
});

test("garage operational restrictions are persisted and enforced in matching and acceptance", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260724100000_add_admin_control_center/migration.sql",
  );
  const service = read("server/src/admin/services/garageOperational.service.js");
  const garageSearch = read("server/src/services/garage.service.js");
  const requests = read("server/src/services/garageRequest.service.js");

  assert.match(schema, /enum GarageOperationalStatus/);
  assert.match(schema, /TEMPORARILY_SUSPENDED/);
  assert.match(schema, /DOCUMENTS_EXPIRED/);
  assert.match(migration, /ADD COLUMN "operationalStatus"/);
  assert.match(service, /reactivateExpiredGarageSuspensions/);
  assert.match(service, /garageBroadcastRequest\.updateMany/);
  assert.match(garageSearch, /operationalStatus:\s*"ACTIVE"/);
  assert.match(garageSearch, /g\."operationalStatus" = 'ACTIVE'/);
  assert.match(requests, /operationalStatus:\s*"ACTIVE"/);
});

test("escalations, pricing coverage, CSV import, schedules, and availability rules are wired", () => {
  const schema = read("server/prisma/schema.prisma");
  const routes = read("server/src/admin/routes/adminControlCenter.routes.js");
  const service = read("server/src/admin/services/adminControlCenter.service.js");
  const schedule = read("server/src/admin/services/priceSchedule.service.js");
  const escalation = read("server/src/admin/services/bookingEscalation.service.js");
  const availability = read("server/src/services/serviceAvailabilityRule.service.js");
  const customerServices = read("server/src/customer/services/service.service.js");

  assert.match(schema, /model AdminAuditLog/);
  assert.match(schema, /model BookingEscalation/);
  assert.match(schema, /model PriceRangeSchedule/);
  assert.match(schema, /model ServiceAvailabilityRule/);
  assert.match(routes, /"\/pricing\/coverage"/);
  assert.match(routes, /"\/pricing\/import"/);
  assert.match(routes, /"\/pricing\/schedules"/);
  assert.match(routes, /"\/availability-rules"/);
  assert.match(service, /getPricingCoverage/);
  assert.match(service, /exportPriceRangesCsv/);
  assert.match(service, /importPriceRanges/);
  assert.match(schedule, /previousRange/);
  assert.match(schedule, /applyDuePriceSchedules/);
  assert.match(escalation, /NO_GARAGE_ACCEPTED/);
  assert.match(escalation, /PAYMENT_STUCK/);
  assert.match(availability, /filterServicesByAvailabilityRules/);
  assert.match(availability, /filterGaragesByAvailabilityRules/);
  assert.match(customerServices, /filterServicesByAvailabilityRules/);
});

test("applied price schedules are reverted when they expire or are cancelled", () => {
  const schedule = read("server/src/admin/services/priceSchedule.service.js");

  assert.match(schedule, /status:\s*"APPLIED",\s*endsAt:\s*\{ lte: now \}/);
  assert.match(schedule, /stillScheduledValue/);
  assert.match(schedule, /previousRange/);
  assert.match(schedule, /schedule\.status === "APPLIED"[\s\S]*endsAt: new Date\(\)[\s\S]*applyDuePriceSchedules/);
});

test("availability rules preserve anonymous discovery and enforce known vehicle scopes", () => {
  const prismaPath = require.resolve("../../src/config/prisma");
  const availabilityPath = require.resolve("../../src/services/serviceAvailabilityRule.service");
  const previousPrisma = require.cache[prismaPath];
  const previousAvailability = require.cache[availabilityPath];
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {},
  };
  delete require.cache[availabilityPath];

  try {
    const { isServiceAllowed } = require(availabilityPath);
    const allowBrandRule = {
      isActive: true,
      effect: "ALLOW",
      vehicleBrand: "Tata",
      cityId: null,
      garageId: null,
      dayOfWeek: null,
      startTime: null,
      endTime: null,
    };

    assert.equal(isServiceAllowed({ rules: [allowBrandRule], context: {} }), true);
    assert.equal(
      isServiceAllowed({ rules: [allowBrandRule], context: { vehicle: { brand: "Tata" } } }),
      true,
    );
    assert.equal(
      isServiceAllowed({ rules: [allowBrandRule], context: { vehicle: { brand: "Honda" } } }),
      false,
    );
    assert.equal(
      isServiceAllowed({
        rules: [{ ...allowBrandRule, effect: "DENY" }],
        context: { vehicle: { brand: "Tata" } },
      }),
      false,
    );
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousAvailability) require.cache[availabilityPath] = previousAvailability;
    else delete require.cache[availabilityPath];
  }
});
