const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("pickup lifecycle stores separate garage arrival, service, delivery, and payment milestones", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260728174500_add_pickup_delivery_payment_confirmation/migration.sql",
  );
  const lifecycle = read("server/src/services/bookingLifecycle.service.js");

  for (const field of [
    "arrivedAtGarageAt",
    "serviceCompletedAt",
    "deliveryStartedAt",
    "finalPaymentMethod",
    "finalPaymentAmount",
    "finalPaymentSubmittedAt",
    "finalPaymentConfirmedAt",
  ]) {
    assert.match(schema, new RegExp(field));
    assert.match(migration, new RegExp(field));
  }

  assert.match(schema, /enum BookingTrackingPhase/);
  assert.match(schema, /PICKUP_TO_CUSTOMER/);
  assert.match(schema, /RETURN_TO_GARAGE/);
  assert.match(schema, /DELIVERY_TO_CUSTOMER/);
  assert.match(lifecycle, /markBookingArrivedAtGarageByGarage/);
  assert.match(lifecycle, /markBookingServiceCompletedByGarage/);
  assert.match(lifecycle, /markBookingArrivedAtCustomerByGarage/);
  assert.match(lifecycle, /submitFinalPaymentByCustomer/);
  assert.match(lifecycle, /confirmFinalPaymentByGarage/);
});

test("customer submits Cash or UPI and garage confirmation is the only completion step", () => {
  const customerRoutes = read("server/src/customer/routes/booking.routes.js");
  const validation = read("server/src/customer/validations/booking.validation.js");
  const garageRoutes = read("server/src/routes/garageRequest.routes.js");
  const lifecycle = read("server/src/services/bookingLifecycle.service.js");

  assert.match(customerRoutes, /\/:id\/submit-final-payment/);
  assert.match(validation, /isIn\(\["CASH", "UPI"\]\)/);
  assert.match(garageRoutes, /confirm-final-payment/);
  assert.match(
    lifecycle,
    /finalPaymentSubmittedAt: submittedAt[\s\S]*status: BOOKING_STATUS\.COMPLETED/,
  );
  assert.match(lifecycle, /finalPaymentConfirmedAt: confirmedAt/);
  assert.match(lifecycle, /customerAcceptedAt: confirmedAt/);
});

test("pickup and delivery maps change destination by journey phase", () => {
  const tracking = read("server/src/maps/services/bookingTracking.service.js");
  const liveMap = read("client/src/components/maps/LiveBookingTracking.jsx");
  const garagePage = read("client/src/pages/garage/BookingDetail.jsx");
  const customerPage = read("client/src/pages/booking/Tracking.jsx");

  assert.match(tracking, /getTrackingPhase/);
  assert.match(tracking, /journeyPhase/);
  assert.match(tracking, /booking\.garage\.latitude/);
  assert.match(tracking, /booking\.customerLatitude/);
  assert.match(liveMap, /Live route from the customer back to the assigned garage/);
  assert.match(liveMap, /Live delivery route from the garage to the customer/);
  assert.match(garagePage, /Reached Garage — Start Service/);
  assert.match(garagePage, /Arrived at Customer/);
  assert.match(customerPage, /Live vehicle delivery/);
});

test("elapsed timer and pending payment controls appear in customer, garage, and task-link views", () => {
  const timer = read("client/src/components/booking/BookingElapsedTimer.jsx");
  const garagePage = read("client/src/pages/garage/BookingDetail.jsx");
  const customerPage = read("client/src/pages/booking/Tracking.jsx");
  const customerList = read("client/src/pages/customer/ActiveBookings.jsx");
  const workerPage = read("client/src/pages/worker/WorkerTask.jsx");
  const workerRoutes = read("server/src/routes/publicWorkerTask.routes.js");

  assert.match(timer, /Time since garage accepted/);
  assert.match(timer, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 1000\)/);
  assert.match(garagePage, /BookingElapsedTimer booking=\{booking\}/);
  assert.match(customerPage, /BookingElapsedTimer booking=\{booking\}/);
  assert.match(customerList, /BookingElapsedTimer/);
  assert.match(customerPage, /Send Payment Details/);
  assert.match(garagePage, /Payment Received — Complete Booking/);
  assert.match(workerPage, /Payment received — complete booking/);
  assert.match(workerRoutes, /payment\/confirm/);
});

test("service completion sends email before final delivery and payment", () => {
  const lifecycle = read("server/src/services/bookingLifecycle.service.js");

  assert.match(lifecycle, /sendCustomerServiceCompletedEmail/);
  assert.match(lifecycle, /Service complete:.*is on the way/);
  assert.match(lifecycle, /deliveryStartedAt: selfDropOff \? null : serviceCompletedAt/);
  assert.match(lifecycle, /sendCustomerServiceCompletedWhatsapp/);
});
