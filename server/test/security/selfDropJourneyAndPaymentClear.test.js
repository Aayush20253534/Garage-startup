const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("self drop has one customer-to-garage tracking phase and no handover OTP", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260728183000_add_self_drop_tracking_phase/migration.sql",
  );
  const tracking = read("server/src/maps/services/bookingTracking.service.js");
  const mapRoutes = read("server/src/maps/routes/maps.routes.js");
  const acceptance = read("server/src/services/garageRequest.service.js");
  const lifecycle = read("server/src/services/bookingLifecycle.service.js");

  assert.match(schema, /SELF_DROP_TO_GARAGE/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'SELF_DROP_TO_GARAGE'/);
  assert.match(tracking, /SELF_DROP_TO_GARAGE: "SELF_DROP_TO_GARAGE"/);
  assert.match(
    tracking,
    /account\.role === "CUSTOMER"[\s\S]*bookingUsesSelfDropOff\(booking\)[\s\S]*booking\.userId === account\.id/,
  );
  assert.match(tracking, /source: "CUSTOMER"/);
  assert.match(
    tracking,
    /Self drop-off live tracking is available only to the customer while travelling to the garage/,
  );
  assert.match(
    mapRoutes,
    /tracking\/start"[\s\S]*authorizeRoles\("CUSTOMER", "GARAGE_OWNER", "GARAGE_CONTROLLER", "ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(acceptance, /const handoverOtp = selfDropOff\s*\? null/);
  assert.match(lifecycle, /Self drop-off bookings do not require a handover OTP/);
  assert.match(lifecycle, /not-required-for-self-drop/);
  assert.match(lifecycle, /confirmSelfDropArrivalByGarage/);
});

test("self drop arrival requires customer proximity and before-service media", () => {
  const lifecycle = read("server/src/services/bookingLifecycle.service.js");
  const routes = read("server/src/routes/garageRequest.routes.js");
  const controller = read("server/src/controllers/garageRequest.controller.js");
  const garageApi = read("client/src/api/garage.js");
  const garagePage = read("client/src/pages/garage/BookingDetail.jsx");
  const workerService = read("server/src/services/garageWorkerTask.service.js");
  const workerPage = read("client/src/pages/worker/WorkerTask.jsx");

  assert.match(
    lifecycle,
    /source: "CUSTOMER",[\s\S]*journeyPhase: "SELF_DROP_TO_GARAGE"/,
  );
  assert.match(lifecycle, /distanceMeters > GARAGE_ARRIVAL_DISTANCE_METERS/);
  assert.match(
    lifecycle,
    /uploadInspectionMedia\(\{[\s\S]*phase: "PICKUP",[\s\S]*images,[\s\S]*video/,
  );
  assert.match(lifecycle, /arrivedAtGarageAt,[\s\S]*trackingEndedAt: arrivedAtGarageAt/);
  assert.match(routes, /confirm-self-drop-arrival/);
  assert.match(controller, /confirmSelfDropArrival/);
  assert.match(garageApi, /confirmSelfDropArrival/);
  assert.match(garagePage, /Confirm Arrival & Start Service/);
  assert.match(garagePage, /No OTP is required/);
  assert.match(workerService, /confirmSelfDropArrivalByGarage/);
  assert.match(workerPage, /Confirm arrival and start service/);
});

test("customer and garage UIs show the one self-drop map and stop its timer at garage arrival", () => {
  const timer = read("client/src/components/booking/BookingElapsedTimer.jsx");
  const customerTracking = read("client/src/pages/booking/Tracking.jsx");
  const liveMap = read("client/src/components/maps/LiveBookingTracking.jsx");
  const timeline = read("client/src/utils/bookingTimeline.js");
  const checkout = read("client/src/pages/booking/Checkout.jsx");

  assert.match(timer, /booking\?\.arrivedAtGarageAt \|\| null/);
  assert.match(timer, /Customer travel time to garage/);
  assert.match(timer, /Stopped when the garage confirmed arrival/);
  assert.match(customerTracking, /SELF_DROP_TO_GARAGE/);
  assert.match(customerTracking, /canShare=\{isSelfDropOff\}/);
  assert.match(liveMap, /Share your journey to the garage/);
  assert.match(liveMap, /Tracking stops when garage staff confirms your arrival/);
  assert.match(timeline, /one-time live route while taking the vehicle there/);
  assert.match(checkout, /No handover OTP is required/);
});

test("service history exposes pickup and self-drop stage durations", () => {
  const history = read("client/src/pages/customer/ServiceHistory.jsx");

  for (const label of [
    "Home to garage",
    "Garage to customer",
    "Return to garage",
    "Service work",
    "Delivery to customer",
    "Payment confirmation",
    "Total booking time",
  ]) {
    assert.match(history, new RegExp(label));
  }

  assert.match(history, /formatDuration\(item\.start, item\.end\)/);
  assert.match(history, /Self drop-off/);
  assert.match(history, /Pickup and delivery/);
});

test("Admin Payments exposes the existing main-admin guarded clear-all command", () => {
  const page = read("client/src/pages/admin/Payments.jsx");
  const api = read("client/src/api/admin.js");
  const dangerousRoutes = read("server/src/admin/routes/dangerous.routes.js");
  const dangerousService = read("server/src/admin/services/dangerous.service.js");

  assert.match(page, /user\?\.role === "ADMIN"/);
  assert.match(page, /Clear all payments/);
  assert.match(page, /rovauto delete-all-payments/);
  assert.match(page, /runDangerousCommand\("delete-all-payments"/);
  assert.match(page, /resets all customer and garage wallet balances to zero/);
  assert.match(api, /runDangerousCommand/);
  assert.match(dangerousRoutes, /authorizeRoles\("ADMIN"\)/);
  assert.match(dangerousService, /command: "delete-all-payments"/);
  assert.match(dangerousService, /result = await deleteAllPayments\(\)/);
});
