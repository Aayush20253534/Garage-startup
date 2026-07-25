const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("service and garage fulfilment modes are persisted with safe defaults", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260725173000_add_customer_and_garage_fulfillment_modes/migration.sql",
  );

  assert.match(schema, /fulfillmentType\s+ServiceFulfillmentMode\s+@default\(BOTH\)/);
  assert.match(schema, /fulfillmentMode\s+GarageFulfillmentMode\s+@default\(BOTH\)/);
  assert.match(schema, /enum ServiceFulfillmentMode[\s\S]*BOTH[\s\S]*SELF_DROP_OFF/);
  assert.match(schema, /enum GarageFulfillmentMode[\s\S]*PICKUP_DELIVERY[\s\S]*SELF_DROP_OFF/);
  assert.match(migration, /WHEN "fulfillmentType"::text = 'SELF_DROP_OFF'/);
  assert.match(migration, /ELSE 'BOTH'::"ServiceFulfillmentMode"/);
  assert.match(migration, /ADD COLUMN "fulfillmentMode"/);
});

test("customer checkout selects one booking mode and backend validates service support", () => {
  const checkout = read("client/src/pages/booking/Checkout.jsx");
  const bookingValidation = read(
    "server/src/customer/validations/booking.validation.js",
  );
  const bookingService = read(
    "server/src/customer/services/booking.service.js",
  );

  assert.match(checkout, /Choose vehicle handover/);
  assert.match(checkout, /fulfillmentType,/);
  assert.match(checkout, /requiresSelfDropOff/);
  assert.match(bookingValidation, /body\("fulfillmentType"\)[\s\S]*optional/);
  assert.match(bookingService, /requiredFulfillmentType \|\| SERVICE_FULFILLMENT_TYPE\.PICKUP_DELIVERY/);
  assert.match(bookingService, /allServicesSupportFulfillmentType/);
  assert.match(bookingService, /getRequiredServiceFulfillmentType/);
});

test("admin garage mode and notification eligibility include handover and vehicle brand checks", () => {
  const garageAdmin = read("client/src/pages/admin/Garages.jsx");
  const garageValidation = read(
    "server/src/admin/validations/garageAdmin.validation.js",
  );
  const requestService = read("server/src/services/garageRequest.service.js");
  const capabilityService = read("server/src/utils/garageCapabilities.js");
  const whatsappService = read("server/src/services/garageWhatsapp.service.js");
  const prismaSchemaCheck = read("server/src/scripts/assertPrismaClientSchema.js");

  assert.match(garageAdmin, /Pickup and self drop-off/);
  assert.match(garageAdmin, /Pickup & delivery only/);
  assert.match(garageAdmin, /Self drop-off only/);
  assert.match(garageValidation, /body\("fulfillmentMode"\)/);
  assert.match(requestService, /fulfillmentType: booking\.fulfillmentType/);
  assert.match(requestService, /supportedBrands: true/);
  assert.match(requestService, /operationalStatus: "ACTIVE"/);
  assert.match(requestService, /This garage no longer supports the booking mode/);
  assert.match(whatsappService, /Self drop-off & customer pickup/);
  assert.match(prismaSchemaCheck, /missingGarageFields/);
  assert.match(capabilityService, /garageSupportsFulfillmentType/);
  assert.match(capabilityService, /garageSupportsVehicleBrand/);
});
