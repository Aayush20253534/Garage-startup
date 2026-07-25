const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("admin accounts can be switched between Admin and Main Admin", () => {
  const validation = read(
    "server/src/admin/validations/subAdminAccount.validation.js",
  );
  const controller = read(
    "server/src/admin/controllers/subAdminAccount.controller.js",
  );
  const service = read(
    "server/src/admin/services/subAdminAccount.service.js",
  );
  const page = read("client/src/pages/admin/SubAdminAccounts.jsx");

  assert.match(validation, /isIn\(\["ADMIN", "SUB_ADMIN"\]\)/);
  assert.match(controller, /req\.user/);
  assert.match(service, /ADMIN_ROLES = \["ADMIN", "SUB_ADMIN"\]/);
  assert.match(service, /role: \{ in: ADMIN_ROLES \}/);
  assert.match(service, /Only a Main Admin can switch admin roles/);
  assert.match(service, /You cannot change your own role while signed in/);
  assert.match(service, /At least one active Main Admin must remain/);
  assert.match(service, /roleChanged/);
  assert.match(service, /staffSession\.updateMany/);
  assert.match(page, /<option value="SUB_ADMIN">Admin<\/option>/);
  assert.match(page, /<option value="ADMIN">Main Admin<\/option>/);
  assert.match(page, /payload\.role = editing\.role/);
  assert.match(page, /Existing sessions were revoked/);
});

test("dangerous commands remain limited to Main Admin after role switching", () => {
  const dangerousRoutes = read("server/src/admin/routes/dangerous.routes.js");
  const app = read("client/src/App.jsx");
  const layout = read("client/src/layouts/DashboardLayout.jsx");

  assert.match(dangerousRoutes, /router\.use\(authorizeRoles\("ADMIN"\)\)/);
  assert.match(app, /path="\/admin\/dangerous"[\s\S]*<ProtectedRoute mainAdminOnly>/);
  assert.match(layout, /!item\.mainAdminOnly \|\| user\?\.role === "ADMIN"/);
});
