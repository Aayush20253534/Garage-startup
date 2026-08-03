const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("cart pricing context survives same-city address hydration", async () => {
  const moduleUrl = pathToFileURL(
    path.join(repoRoot, "client/src/utils/bookingCart.js"),
  ).href;
  const { getCartPricingContextKey } = await import(moduleUrl);

  const vehicle = { id: "vehicle-1" };
  const originalLocation = {
    id: "temporary-location",
    city: "Prayagraj",
    address: "Civil Lines",
    latitude: 25.4358,
    longitude: 81.8463,
  };
  const hydratedLocation = {
    id: "saved-location",
    placeId: "google-place-id",
    city: " prayagraj ",
    formattedAddress: "Civil Lines, Prayagraj, Uttar Pradesh",
    latitude: 25.436,
    longitude: 81.847,
  };

  assert.equal(
    getCartPricingContextKey(vehicle, originalLocation),
    getCartPricingContextKey(vehicle, hydratedLocation),
  );
  assert.notEqual(
    getCartPricingContextKey(vehicle, originalLocation),
    getCartPricingContextKey(vehicle, {
      ...hydratedLocation,
      city: "Lucknow",
    }),
  );
  assert.notEqual(
    getCartPricingContextKey(vehicle, originalLocation),
    getCartPricingContextKey({ id: "vehicle-2" }, originalLocation),
  );
});

test("one payment click survives transient Cashfree and network preparation", () => {
  const appProvider = read("client/src/hooks/useApp.jsx");
  const paymentClient = read("client/src/utils/bookingPayment.js");
  const checkout = read("client/src/pages/booking/Checkout.jsx");
  const pendingBookings = read(
    "client/src/pages/customer/PendingBookings.jsx",
  );
  const paymentService = read(
    "server/src/customer/services/payment.service.js",
  );

  const retryDelays = paymentClient.match(
    /PAYMENT_ORDER_RETRY_DELAYS_MS\s*=\s*\[([^\]]+)\]/,
  );
  assert.ok(retryDelays, "payment retry schedule should be present");
  assert.ok(
    retryDelays[1].split(",").length >= 5,
    "payment preparation should be retried without another user tap",
  );

  assert.match(appProvider, /if \(authLoading\) return;/);
  assert.doesNotMatch(appProvider, /getLocationIdentity/);
  assert.match(paymentClient, /isRetryablePaymentOrderError/);
  assert.match(paymentClient, /RETRYABLE_PAYMENT_NETWORK_CODES/);
  assert.match(checkout, /paymentAttemptRef\.current/);
  assert.match(pendingBookings, /paymentAttemptRef\.current/);
  assert.match(
    paymentService,
    /409,[\s\S]{0,180}PAYMENT_SESSION_UNAVAILABLE/,
  );
});

test("restoring an authenticated customer keeps the checkout cart", () => {
  const appProvider = read("client/src/hooks/useApp.jsx");
  const restoreStart = appProvider.indexOf("const restoreSession = async () =>");
  const restoreEnd = appProvider.indexOf("restoreSession();", restoreStart);
  const restoreSession = appProvider.slice(restoreStart, restoreEnd);

  assert.ok(restoreStart >= 0, "session restoration should be present");
  assert.ok(restoreEnd > restoreStart, "session restoration should be callable");
  assert.match(restoreSession, /me\.role === "CUSTOMER"/);
  assert.match(
    restoreSession,
    /preserveCartContextChangeRef\.current = preserveCustomerCart/,
  );
  assert.match(restoreSession, /preserveCart: preserveCustomerCart/);
});
