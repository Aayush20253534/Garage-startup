const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const {
  garageCanServeBooking,
  garageSupportsFulfillmentType,
} = require("../../src/utils/garageCapabilities");

test("self-drop-only garages and unsupported vehicles are excluded before notifications", () => {
  const serviceId = "service-1";
  const baseGarage = {
    fulfillmentMode: "SELF_DROP_OFF",
    supportedBrands: ["Hyundai"],
    excludedServiceBrands: [],
    services: [
      {
        serviceId,
        vehicleBrand: "Hyundai",
        vehicleModel: "i20",
        isExcluded: false,
        isActive: true,
        service: { isActive: true, category: { isActive: true } },
      },
    ],
  };

  assert.equal(
    garageSupportsFulfillmentType(baseGarage, "PICKUP_DELIVERY"),
    false,
  );
  assert.equal(
    garageSupportsFulfillmentType(baseGarage, "SELF_DROP_OFF"),
    true,
  );
  assert.equal(
    garageCanServeBooking({
      garage: baseGarage,
      serviceIds: [serviceId],
      vehicle: { brand: "Hyundai", model: "i20" },
      fulfillmentType: "PICKUP_DELIVERY",
    }),
    false,
  );
  assert.equal(
    garageCanServeBooking({
      garage: { ...baseGarage, fulfillmentMode: "BOTH" },
      serviceIds: [serviceId],
      vehicle: { brand: "Tata", model: "Nexon" },
      fulfillmentType: "PICKUP_DELIVERY",
    }),
    false,
  );
});

test("controller-disabled garages use secure no-account worker task links", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260728090000_add_garage_worker_task_mode/migration.sql",
  );
  const taskService = read("server/src/services/garageWorkerTask.service.js");
  const controllerService = read("server/src/garage/services/controller.service.js");
  const authMiddleware = read("server/src/middlewares/auth.middleware.js");
  const requestService = read("server/src/services/garageRequest.service.js");

  assert.match(schema, /controllerAccountsEnabled\s+Boolean\s+@default\(true\)/);
  assert.match(schema, /model GarageWorkerTask \{/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(migration, /CREATE TABLE "garage_worker_tasks"/);
  assert.match(taskService, /crypto\.randomBytes\(32\)/);
  assert.match(taskService, /createHash\("sha256"\)/);
  assert.match(taskService, /Disable controller accounts/);
  assert.match(controllerService, /garage: \{ controllerAccountsEnabled: true \}/);
  assert.match(authMiddleware, /controllerAccountsEnabled !== false/);
  assert.match(requestService, /controllerAccountsEnabled === false/);
  assert.match(requestService, /getAvailableControllers/);
  assert.match(requestService, /whatsapp_fallback/);
});

test("worker task routes support tracking and structured evidence without worker auth", () => {
  const publicRoutes = read("server/src/routes/publicWorkerTask.routes.js");
  const managerRoutes = read("server/src/routes/garageWorkerTask.routes.js");
  const tracking = read("server/src/maps/services/bookingTracking.service.js");
  const taskService = read("server/src/services/garageWorkerTask.service.js");
  const workerUi = read("client/src/pages/worker/WorkerTask.jsx");
  const whatsapp = read("server/src/services/garageWhatsapp.service.js");

  assert.match(publicRoutes, /\/:token\/tracking\/location/);
  assert.match(publicRoutes, /\/:token\/handover/);
  assert.match(publicRoutes, /handover\/complete-journey/);
  assert.match(publicRoutes, /\/:token\/delivery/);
  assert.match(publicRoutes, /payment\/confirm/);
  assert.doesNotMatch(publicRoutes, /router\.use\(protect\)/);
  assert.match(managerRoutes, /authorizeRoles\("ADMIN", "SUB_ADMIN", "GARAGE_OWNER"\)/);
  assert.match(tracking, /workerTaskId: workerTask\.id/);
  assert.match(taskService, /RETURN_TO_GARAGE/);
  assert.match(taskService, /completeHandoverJourney/);
  assert.match(taskService, /confirmFinalPayment/);
  assert.match(workerUi, /navigator\.geolocation\.watchPosition/);
  assert.match(workerUi, /SpeechSynthesisUtterance/);
  assert.match(workerUi, /utterance\.lang = language === "hi" \? "hi-IN" : "en-IN"/);
  assert.match(whatsapp, /garage_worker_task_assignment/);
  assert.match(whatsapp, /No worker login or worker OTP is required/);
});
