const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  generateBookingCode,
  withUniqueBookingCode,
} = require("../../src/utils/bookingCode");
const {
  getCurrentClockMinutes,
  isGarageOpenNow,
} = require("../../src/utils/garageHours");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("booking codes use cryptographic randomness and retry database conflicts", async () => {
  const first = generateBookingCode();
  const second = generateBookingCode();
  assert.match(first, /^ROV-[A-Z0-9]+-[A-F0-9]{12}$/);
  assert.notEqual(first, second);

  let attempts = 0;
  const created = await withUniqueBookingCode(async (bookingCode) => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error("duplicate booking code");
      error.code = "P2002";
      error.meta = { target: ["bookingCode"] };
      throw error;
    }
    return bookingCode;
  });

  assert.equal(attempts, 3);
  assert.match(created, /^ROV-/);
});

test("public auth cannot create garage-owner accounts", () => {
  const validation = read("src/customer/validations/auth.validation.js");
  const service = read("src/customer/services/auth.service.js");
  assert.match(validation, /PUBLIC_SIGNUP_ROLES = \["CUSTOMER"\]/);
  assert.match(service, /Garage owner accounts are created only after application approval/);
  assert.doesNotMatch(validation, /PUBLIC_SIGNUP_ROLES = \[[^\]]*GARAGE_OWNER/);
});

test("legacy JWTs cannot recreate or un-revoke sessions", () => {
  const middleware = read("src/middlewares/auth.middleware.js");
  const sessions = read("src/customer/services/userSession.service.js");
  assert.match(middleware, /Legacy session expired\. Please log in again/);
  assert.doesNotMatch(middleware, /ensureLegacyUserSession/);
  assert.doesNotMatch(sessions, /ensureLegacyUserSession/);
});

test("container context excludes runtime secrets", () => {
  const dockerignore = read(".dockerignore");
  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^\*\.pem$/m);
  assert.match(dockerignore, /^\*\.key$/m);
});

test("approval queues email transactionally and fatal errors trigger shutdown", () => {
  const applicationService = read("src/garage/services/application.service.js");
  const server = read("src/server.js");
  assert.match(applicationService, /enqueueOptionalApplicationEmail\(\{/);
  assert.match(applicationService, /client: tx/);
  assert.match(applicationService, /emailDelivery/);
  assert.match(server, /startGarageApplicationEmailOutboxWorker/);
  assert.match(server, /unhandledRejection[\s\S]*shutdown/);
  assert.match(server, /SHUTDOWN_TIMEOUT_MS/);
});

test("owner-only garage routes reject staff identities", () => {
  for (const file of [
    "src/routes/garage.routes.js",
    "src/routes/garageRequest.routes.js",
    "src/routes/garageWallet.routes.js",
    "src/garage/routes/wallet.routes.js",
  ]) {
    const source = read(file);
    assert.match(source, /protectUser/);
    assert.doesNotMatch(source, /authorizeRoles\("GARAGE_OWNER", "ADMIN"\)/);
  }
});

test("garage hours use the configured timezone and support overnight schedules", () => {
  const instant = new Date("2026-01-01T12:00:00.000Z");
  assert.equal(getCurrentClockMinutes(instant, "Asia/Kolkata"), 17 * 60 + 30);
  assert.equal(
    isGarageOpenNow(
      { openingTime: "20:00", closingTime: "02:00" },
      new Date("2026-01-01T21:00:00.000Z"),
      "UTC",
    ),
    true,
  );
  assert.equal(
    isGarageOpenNow(
      { openingTime: "20:00", closingTime: "02:00" },
      new Date("2026-01-01T03:00:00.000Z"),
      "UTC",
    ),
    false,
  );
});

test("wallet pagination and garage profile updates are bounded", () => {
  const wallet = read("src/garage/validations/wallet.validation.js");
  const profile = read("src/validations/garageAccount.validation.js");
  const ownerService = read("src/garage/services/garageOwner.service.js");
  assert.match(wallet, /isInt\(\{ min: 1, max: 100 \}\)/);
  assert.match(profile, /isFloat\(\{ min: -90, max: 90 \}\)/);
  assert.match(profile, /isInt\(\{ min: 1, max: 100 \}\)/);
  assert.match(ownerService, /invalidatePublicCache\(\)/);
});

test("diagnostic reports omit query values and redact credentials", () => {
  const clientReporter = read("../client/src/utils/errorReporter.js");
  const serverReporter = read("src/services/systemIssueReporter.service.js");
  assert.match(clientReporter, /stripQueryAndFragment/);
  assert.doesNotMatch(clientReporter, /params: config\.params/);
  assert.match(serverReporter, /queryKeys: Object\.keys/);
  assert.match(serverReporter, /REDACTED_JWT/);
});
