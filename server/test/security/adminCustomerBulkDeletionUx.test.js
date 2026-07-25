const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

test("bulk customer deletion is available to admins and sub-admins and restricted to customer accounts", () => {
  const routes = read("src/admin/routes/adminOperations.routes.js");
  const validation = read("src/admin/validations/adminOperations.validation.js");
  const dangerousService = read("src/admin/services/dangerous.service.js");

  assert.match(routes, /router\.delete\([\s\S]*"\/customers"[\s\S]*authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(validation, /isArray\(\{ min: 1, max: 100 \}\)/);
  assert.match(dangerousService, /role: "CUSTOMER"/);
  assert.match(dangerousService, /deleteCustomerUsersByIds/);
  assert.match(dangerousService, /await deleteUserData/);
});

test("customer selection UI and responsive refinements remain wired", () => {
  const customers = read("../client/src/pages/admin/Customers.jsx");
  const notifications = read("../client/src/pages/customer/Notifications.jsx");
  const chatbot = read("../client/src/components/ChatbotPopup.jsx");
  const partner = read("../client/src/pages/Partner.jsx");
  const garageLogin = read("../client/src/pages/garage/auth/Login.jsx");

  assert.match(customers, /selectedCustomerIds/);
  assert.match(customers, /Delete selected/);
  assert.match(notifications, /optimistic/);
  assert.match(chatbot, /h-dvh/);
  assert.match(partner, /GaragePwaInstall/);
  assert.match(garageLogin, /lg:hidden/);
});
