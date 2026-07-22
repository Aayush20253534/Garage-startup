const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("customer notifications are strictly scoped to their account owner", () => {
  const notificationService = read(
    "server/src/customer/services/notification.service.js",
  );
  const adminOperations = read(
    "server/src/admin/services/adminOperations.service.js",
  );
  const ownershipMigration = read(
    "server/prisma/migrations/20260717110000_enforce_notification_ownership/migration.sql",
  );
  const allAudienceStart = adminOperations.indexOf(
    'if (audience === "ALL")',
  );
  const userAudienceStart = adminOperations.indexOf(
    'if (audience === "USER")',
    allAudienceStart,
  );
  const allAudienceBlock = adminOperations.slice(
    allAudienceStart,
    userAudienceStart,
  );

  assert.match(notificationService, /where: \{ userId \}/);
  assert.match(notificationService, /notifications:v2/);
  assert.doesNotMatch(notificationService, /sourceNotificationId/);
  assert.match(
    notificationService,
    /\[hasUserTarget, hasGarageOwnerTarget, hasGarageControllerTarget\]\.filter\(Boolean\)/,
  );
  assert.match(allAudienceBlock, /prisma\.notification\.createMany/);
  assert.match(allAudienceBlock, /userId: recipientUserId/);
  assert.doesNotMatch(allAudienceBlock, /createNotification/);
  assert.match(
    ownershipMigration,
    /Notification_exactly_one_owner_check/,
  );
});

test("deleting a customer hard-deletes owned and non-FK account data", () => {
  const customerService = read(
    "server/src/customer/services/customer.service.js",
  );
  const customerController = read(
    "server/src/customer/controllers/customer.controller.js",
  );
  const schema = read("server/prisma/schema.prisma");

  assert.match(customerService, /prisma\.\$transaction/);
  assert.match(customerService, /tx\.notification\.deleteMany/);
  assert.match(customerService, /tx\.systemIssue\.deleteMany/);
  assert.match(customerService, /tx\.customerSupportEmailLog\.deleteMany/);
  assert.match(customerService, /tx\.emailOtp\.deleteMany/);
  assert.match(customerService, /tx\.phoneOtp\.deleteMany/);
  assert.match(customerService, /tx\.pendingSignup\.deleteMany/);
  assert.match(customerService, /tx\.user\.delete\(/);
  assert.doesNotMatch(customerService, /isActive:\s*false/);
  assert.match(customerService, /deleteCloudinaryImagesIfUnreferenced/);
  assert.match(customerController, /res\.clearCookie/);
  assert.match(
    schema,
    /model Notification[\s\S]*user\s+User\?[\s\S]*onDelete: Cascade/,
  );
});

test("pending-payment status stays compact and map overlays keep native size", () => {
  const pendingBookings = read(
    "client/src/pages/customer/PendingBookings.jsx",
  );
  const mapPanel = read("client/src/components/maps/MapPanel.jsx");
  const globalCss = read("client/src/index.css");

  assert.match(pendingBookings, /Payment pending/);
  assert.match(
    pendingBookings,
    /flex min-w-0 items-center justify-between gap-3/,
  );
  assert.match(mapPanel, /rovauto-google-map-canvas/);
  assert.match(
    globalCss,
    /\.rovauto-google-map > \.rovauto-google-map-canvas/,
  );
  assert.doesNotMatch(globalCss, /\.rovauto-google-map > div,/);
});
