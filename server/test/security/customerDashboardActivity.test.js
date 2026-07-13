const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("customer, tracking, and garage views share one six-stage timeline", async () => {
  const timelinePath = path.join(
    repoRoot,
    "client/src/utils/bookingTimeline.js",
  );
  const timeline = await import(pathToFileURL(timelinePath).href);

  assert.deepEqual(
    timeline.BOOKING_TIMELINE_STEPS.map((step) => step.label),
    [
      "Request Sent",
      "Booking Accepted",
      "Vehicle Handover",
      "Service In Progress",
      "Awaiting Customer Acceptance",
      "Completed",
    ],
  );

  assert.equal(
    timeline.getBookingTimelineState({ status: "SEARCHING_GARAGE" })
      .currentIndex,
    0,
  );
  assert.equal(
    timeline.getBookingTimelineState({ status: "CONFIRMED" }).currentIndex,
    2,
  );
  assert.equal(
    timeline.getBookingTimelineState({ status: "IN_PROGRESS" }).currentIndex,
    3,
  );
  assert.equal(
    timeline.getBookingTimelineState({
      status: "IN_PROGRESS",
      deliveredAt: "2026-07-13T00:00:00.000Z",
    }).currentIndex,
    4,
  );
  assert.equal(
    timeline.getBookingTimelineState({ status: "COMPLETED" }).percent,
    100,
  );

  for (const view of [
    "client/src/pages/customer/Dashboard.jsx",
    "client/src/pages/booking/Tracking.jsx",
    "client/src/pages/garage/BookingDetail.jsx",
  ]) {
    assert.match(read(view), /BOOKING_TIMELINE_STEPS/);
    assert.match(read(view), /getBookingTimelineState/);
  }
});

test("dashboard always renders recent activity and shortcuts separately", () => {
  const dashboard = read("client/src/pages/customer/Dashboard.jsx");

  assert.match(dashboard, /Recent Activity/);
  assert.match(dashboard, /Shortcuts/);
  assert.match(dashboard, /quickActions\.map/);
  assert.doesNotMatch(dashboard, /recentActivities\.length[\s\S]*fallbackActions/);
});

test("activity feed covers booking, payment, cancellation, refund, and service lifecycle events", () => {
  const activityService = read(
    "server/src/customer/services/activity.service.js",
  );

  for (const activityType of [
    "BOOKING_CREATED",
    "PAYMENT_PAID",
    "PAYMENT_FAILED",
    "PAYMENT_REFUNDED",
    "GARAGE_ACCEPTED",
    "SERVICE_STARTED",
    "READY_FOR_DELIVERY",
    "BOOKING_COMPLETED",
    "BOOKING_CANCELLED",
    "BOOKING_EXPIRED",
    "WALLET_REFUND",
    "WALLET_RECHARGE",
    "WALLET_PENDING",
    "WALLET_FAILED",
  ]) {
    assert.match(activityService, new RegExp(activityType));
  }

  const schema = read("server/prisma/schema.prisma");
  assert.match(schema, /eventKey\s+String\?\s+@unique/);
});


test("activity recording cannot abort payment, cancellation, or garage acceptance transactions", () => {
  for (const servicePath of [
    "server/src/customer/services/payment.service.js",
    "server/src/customer/services/booking.service.js",
    "server/src/services/garageRequest.service.js",
  ]) {
    const source = read(servicePath);
    assert.doesNotMatch(source, /createActivitySafely\([\s\S]{0,1000}client:\s*tx/);
  }

  const activityService = read(
    "server/src/customer/services/activity.service.js",
  );
  assert.match(activityService, /status === "FAILED"/);
  assert.match(activityService, /status === "PENDING"/);
});
