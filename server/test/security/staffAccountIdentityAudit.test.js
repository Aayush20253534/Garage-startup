const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("admin portal always displays the exact signed-in staff account", () => {
  const layout = read("client/src/layouts/DashboardLayout.jsx");

  assert.match(layout, /Currently signed in/);
  assert.match(layout, /Active session/);
  assert.match(layout, /account\?\.email \|\| account\?\.loginId/);
  assert.match(layout, /Login ID:/);
  assert.match(layout, /account\?\.role === "SUB_ADMIN" \? "SUB ADMIN" : "MAIN ADMIN"/);
});

test("audit logs snapshot and display email and login ID for each staff account", () => {
  const schema = read("server/prisma/schema.prisma");
  const migration = read(
    "server/prisma/migrations/20260724120000_add_audit_actor_identity/migration.sql",
  );
  const auditService = read("server/src/admin/services/adminAudit.service.js");
  const authService = read("server/src/customer/services/auth.service.js");
  const controlCenter = read("client/src/pages/admin/ControlCenter.jsx");

  assert.match(schema, /actorEmail\s+String\?/);
  assert.match(schema, /actorLoginId\s+String\?/);
  assert.match(migration, /ADD COLUMN "actorEmail" TEXT/);
  assert.match(migration, /ADD COLUMN "actorLoginId" TEXT/);
  assert.match(migration, /FROM "staff_accounts" AS staff/);
  assert.match(auditService, /actorEmail: actor\.email \|\| null/);
  assert.match(auditService, /actorLoginId: actor\.loginId \|\| null/);
  assert.match(auditService, /actorEmail: \{ contains: search/);
  assert.match(auditService, /actorLoginId: \{ contains: search/);
  assert.match(authService, /actorEmail: staff\.email \|\| null/);
  assert.match(authService, /actorLoginId: staff\.loginId \|\| null/);
  assert.match(controlCenter, /Exact staff account/);
  assert.match(controlCenter, /log\.actorEmail \|\| log\.actorLoginId \|\| log\.actorId/);
  assert.match(controlCenter, /Main admins/);
  assert.match(controlCenter, /Sub-admins/);
  assert.match(controlCenter, /Account ID:/);
});
