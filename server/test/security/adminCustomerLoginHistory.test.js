const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("admin customer login history exposes active devices and retained sessions", () => {
  const routes = read("server/src/admin/routes/adminOperations.routes.js");
  const service = read("server/src/admin/services/adminOperations.service.js");
  const api = read("client/src/api/admin.js");
  const page = read("client/src/pages/admin/CustomerLoginHistory.jsx");
  const customers = read("client/src/pages/admin/Customers.jsx");
  const app = read("client/src/App.jsx");

  assert.match(routes, /"\/customers\/:userId\/login-history"/);
  assert.match(service, /const getCustomerLoginHistory = async \(userId\)/);
  assert.match(service, /prisma\.userSession\.findMany/);
  assert.match(service, /activeDeviceMap/);
  assert.match(service, /totalSessionCount: sessionHistory\.length/);
  assert.match(api, /getCustomerLoginHistory\(userId\)/);
  assert.match(page, /Currently logged devices/);
  assert.match(page, /Session history/);
  assert.match(page, /All retained login sessions across every recorded browser or device/);
  assert.match(customers, /View login history/);
  assert.match(app, /\/admin\/customers\/:userId\/login-history/);
  assert.match(app, /\/intern\/customers\/:userId\/login-history/);
});

test("logout from all devices revokes active sessions and removes customer push subscriptions", () => {
  const routes = read("server/src/admin/routes/adminOperations.routes.js");
  const controller = read("server/src/admin/controllers/adminOperations.controller.js");
  const service = read("server/src/admin/services/adminOperations.service.js");
  const api = read("client/src/api/admin.js");
  const page = read("client/src/pages/admin/CustomerLoginHistory.jsx");

  assert.match(
    routes,
    /"\/customers\/:userId\/logout-all"[\s\S]{0,180}authorizeRoles\("ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(controller, /logoutCustomerFromAllDevices/);
  assert.match(service, /tx\.userSession\.updateMany/);
  assert.match(service, /expiresAt: \{ gt: now \}/);
  assert.match(service, /tx\.pushSubscription\.deleteMany/);
  assert.match(service, /invalidateCustomerCache\(userId\)/);
  assert.match(api, /logoutCustomerFromAllDevices\(userId\)/);
  assert.match(page, /Log out from all devices/);
  assert.match(page, /const isIntern = user\?\.role === "INTERN"/);
  assert.match(page, /!isIntern &&/);
});
