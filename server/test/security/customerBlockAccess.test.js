const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("customer block and unblock is admin-only and revokes every session", () => {
  const routes = read("server/src/admin/routes/adminOperations.routes.js");
  const validation = read("server/src/admin/validations/adminOperations.validation.js");
  const service = read("server/src/admin/services/adminOperations.service.js");

  assert.match(
    routes,
    /"\/customers\/:userId\/status"[\s\S]*authorizeRoles\("ADMIN"\)/,
  );
  assert.match(
    validation,
    /updateCustomerStatusSchema[\s\S]*body\("isActive"\)[\s\S]*\.isBoolean\(\)/,
  );
  assert.match(service, /const setCustomerActiveStatus/);
  assert.match(service, /role: "CUSTOMER"/);
  assert.match(
    service,
    /userSession\.updateMany\([\s\S]*userId: existingCustomer\.id[\s\S]*revokedAt: null/,
  );
  assert.match(service, /data: \{ revokedAt: changedAt \}/);
});

test("blocked customers are rejected for password, Google, and existing sessions", () => {
  const authService = read("server/src/customer/services/auth.service.js");
  const authMiddleware = read("server/src/middlewares/auth.middleware.js");
  const axios = read("client/src/api/axios.js");

  assert.ok((authService.match(/CUSTOMER_BLOCKED/g) || []).length >= 3);
  assert.match(
    authService,
    /!user\.isActive[\s\S]*CUSTOMER_BLOCKED_MESSAGE[\s\S]*CUSTOMER_BLOCKED_CODE/,
  );
  assert.match(
    authMiddleware,
    /accountType === "USER" && account\.role === "CUSTOMER"/,
  );
  assert.match(axios, /status === 403[\s\S]*CUSTOMER_BLOCKED_CODE/);
  assert.match(axios, /rov_auth_notice/);
});

test("admin customer UI exposes clear block and unblock actions", () => {
  const api = read("client/src/api/admin.js");
  const page = read("client/src/pages/admin/Customers.jsx");

  assert.match(api, /setCustomerActiveStatus\(userId, isActive\)/);
  assert.match(page, /toggleCustomerAccess/);
  assert.match(page, /logged out on every device/);
  assert.match(page, /\? "Block"/);
  assert.match(page, /: "Unblock"/);
});
