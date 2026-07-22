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
    "src/routes/garageWallet.routes.js",
  ]) {
    const source = read(file);
    assert.match(source, /protectUser/);
    assert.doesNotMatch(source, /authorizeRoles\("GARAGE_OWNER", "ADMIN"\)/);
  }

  for (const file of [
    "src/routes/garageRequest.routes.js",
    "src/garage/routes/wallet.routes.js",
  ]) {
    const source = read(file);
    assert.match(source, /router\.use\(protect\)/);
    assert.match(source, /authorizeRoles\("GARAGE_OWNER", "GARAGE_CONTROLLER"\)/);
    assert.doesNotMatch(source, /"ADMIN"/);
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

test("price ranges enforce one valid row per normalized scope", () => {
  const schema = read("prisma/schema.prisma");
  const service = read("src/admin/services/cityServicePriceRange.service.js");
  const migration = read("prisma/migrations/20260721120000_harden_price_range_scope_integrity/migration.sql");
  assert.match(schema, /scopeKey\s+String\s+@unique/);
  assert.match(service, /cityServicePriceRange\.upsert/);
  assert.match(migration, /CHECK \("minPrice" >= 0 AND "maxPrice" >= "minPrice"\)/);
});

test("ticket uploads alone are capped at 5 MB and clean failed uploads", () => {
  const route = read("src/customer/routes/supportTicket.routes.js");
  const service = read("src/customer/services/supportTicket.service.js");
  assert.match(route, /fileSize: 5 \* 1024 \* 1024/);
  assert.match(route, /support-ticket-create/);
  assert.match(route, /registerUploadCleanup/);
  assert.match(service, /MAX_ATTACHMENT_SIZE = 5 \* 1024 \* 1024/);
  assert.match(service, /deleteFromCloudinary/);
});

test("replacement media is tracked and rolled back when persistence fails", () => {
  const schema = read("prisma/schema.prisma");
  const carMeta = read("src/admin/services/carMeta.service.js");
  const services = read("src/admin/services/serviceAdmin.service.js");
  assert.match(schema, /logoPublicId\s+String\?/);
  assert.match(carMeta, /existingBrand\.logoPublicId/);
  assert.match(carMeta, /deleteUploadedLogo\(logo\)/);
  assert.match(services, /deleteFromCloudinary\(result\.public_id/);
});

test("session retention, cursor lists, and readiness checks are production bounded", () => {
  const retention = read("src/services/sessionRetention.service.js");
  const priceRanges = read("src/admin/services/cityServicePriceRange.service.js");
  const tickets = read("src/customer/services/supportTicket.service.js");
  const complaints = read("src/customer/services/complaint.service.js");
  const app = read("src/app.js");
  for (const model of ["userSession", "staffSession", "garageOwnerSession", "customerSupportSession"]) {
    assert.match(retention, new RegExp(`"${model}"`));
  }
  for (const source of [priceRanges, tickets, complaints]) {
    assert.match(source, /take: limit \+ 1/);
    assert.match(source, /nextCursor/);
  }
  assert.match(app, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(app, /redis\.ping\(\)/);
  assert.match(app, /\/health\/ready/);
  assert.match(app, /\/health\/live/);
});

test("production client excludes the legacy hero PNG and splits large shared dependencies", () => {
  const home = read("../client/src/pages/Home.jsx");
  const partner = read("../client/src/pages/Partner.jsx");
  const vite = read("../client/vite.config.js");

  for (const source of [home, partner]) {
    assert.doesNotMatch(source, /assets\/Rovauto_home\.png/);
    assert.match(source, /Rovauto_home-desktop\.webp/);
  }

  assert.match(vite, /"vendor-react"/);
  assert.match(vite, /"vendor-state"/);
  assert.doesNotMatch(home, /from "framer-motion"/);
});
