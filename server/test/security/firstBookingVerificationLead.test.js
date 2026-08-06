const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("first-booking waiver is decided atomically by the server", () => {
  const bookingService = read("server/src/customer/services/booking.service.js");
  const schema = read("server/prisma/schema.prisma");

  assert.match(schema, /firstBookingOfferConsumedAt\s+DateTime\?/);
  assert.match(schema, /PENDING_VERIFICATION/);
  assert.match(bookingService, /FROM "User" WHERE "id" = \$\{userId\} FOR UPDATE/);
  assert.match(bookingService, /existingBookingCount === 0/);
  assert.match(bookingService, /FIRST_BOOKING_MAX_ESTIMATE/);
  assert.match(bookingService, /firstBookingOfferConsumedAt: new Date\(\)/);
  assert.match(bookingService, /status: firstBookingFeeWaived[\s\S]*PENDING_VERIFICATION/);
  assert.match(bookingService, /handlingFee = firstBookingFeeWaived \? 0/);
});

test("free checkout waits for support approval before garage search", () => {
  const checkout = read("client/src/pages/booking/Checkout.jsx");
  const leadService = read(
    "server/src/customer/services/bookingVerificationLead.service.js",
  );
  const verificationPage = read("client/src/pages/booking/Verification.jsx");

  const freeBranch = checkout.indexOf('booking.status === "PENDING_VERIFICATION"');
  const paymentCall = checkout.indexOf("const paidBooking = await payForBooking");
  assert.ok(freeBranch >= 0 && freeBranch < paymentCall);
  assert.match(checkout, /booking\/verification\/\$\{booking\.id\}/);
  assert.match(leadService, /status: "SEARCHING_GARAGE"/);
  assert.match(leadService, /broadcastBookingToNearbyGarages/);
  assert.match(verificationPage, /data\?\.trackingReady/);
  assert.match(verificationPage, /navigate\("\/tracking"/);
});

test("support lead claim, call timer, decisions, and escalation are exposed", () => {
  const routes = read(
    "server/src/customerSupport/routes/customerSupport.routes.js",
  );
  const leadService = read(
    "server/src/customer/services/bookingVerificationLead.service.js",
  );
  const worker = read(
    "server/src/services/bookingVerificationLeadWorker.service.js",
  );
  const supportPage = read("client/src/pages/support/Leads.jsx");

  for (const route of ["/claim", "/call", "/approve", "/reject"]) {
    assert.ok(routes.includes(route), `missing support lead route ${route}`);
  }
  assert.match(leadService, /claimedById: null/);
  assert.match(leadService, /callDurationSeconds/);
  assert.match(leadService, /sendSuspiciousLeadEmail/);
  assert.match(leadService, /sendUnclaimedEscalationEmail/);
  assert.match(worker, /30_000/);
  assert.match(supportPage, /window\.location\.href = `tel:/);
  assert.match(supportPage, /Reject suspicious/);
});

test("booking status enum migration is committed before dependent index", () => {
  const enumMigration = read(
    "server/prisma/migrations/20260806090000_add_pending_verification_status/migration.sql",
  );
  const leadMigration = read(
    "server/prisma/migrations/20260806090100_add_first_booking_verification_leads/migration.sql",
  );

  assert.match(enumMigration, /ALTER TYPE "BookingStatus" ADD VALUE/);
  assert.doesNotMatch(leadMigration, /ALTER TYPE "BookingStatus" ADD VALUE/);
  assert.match(leadMigration, /Booking_one_active_per_vehicle_idx/);
  assert.match(leadMigration, /'PENDING_VERIFICATION'/);
});
