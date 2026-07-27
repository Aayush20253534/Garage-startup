const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("integration health center is restricted to the main admin and wired end to end", () => {
  const routes = read("server/src/admin/routes/integrationHealth.routes.js");
  const indexRoutes = read("server/src/routes/index.routes.js");
  const app = read("client/src/App.jsx");
  const api = read("client/src/api/admin.js");
  const page = read("client/src/pages/admin/IntegrationHealth.jsx");

  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /router\.use\(authorizeRoles\("ADMIN"\)\)/);
  assert.match(indexRoutes, /"\/admin\/integration-health"/);
  assert.match(app, /label: "Integration Health"/);
  assert.match(app, /mainAdminOnly: true/);
  assert.match(app, /path="\/admin\/integration-health"/);
  assert.match(app, /<ProtectedRoute mainAdminOnly>/);
  assert.match(api, /getIntegrationHealth/);
  assert.match(page, /Integration Health Center/);
  assert.match(page, /Run all checks/);
});

test("health checks cover core infrastructure and external providers with timeouts and caching", () => {
  const service = read("server/src/admin/services/integrationHealth.service.js");

  assert.match(service, /REPORT_CACHE_MS/);
  assert.match(service, /PROBE_TIMEOUT_MS/);
  assert.match(service, /withTimeout/);
  assert.match(service, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(service, /redis\.ping\(\)/);
  assert.match(service, /cloudinary\.api\.ping\(\)/);
  assert.match(service, /graph\.facebook\.com/);
  assert.match(service, /getCashfreeBaseUrl/);
  assert.match(service, /resend\.domains\.list\(\)/);
  assert.match(service, /auth\.listUsers\(1\)/);
  assert.match(service, /WEB_PUSH_VAPID_PUBLIC_KEY/);
  assert.match(service, /overduePriceSchedules/);
});

test("health responses redact provider secrets and expose only operational metadata", () => {
  const service = read("server/src/admin/services/integrationHealth.service.js");
  const page = read("client/src/pages/admin/IntegrationHealth.jsx");

  assert.match(service, /redactError/);
  assert.match(service, /Bearer \[redacted\]/);
  assert.match(service, /\$1=\[redacted\]/);
  assert.match(service, /maskPhone/);
  assert.doesNotMatch(page, /CASHFREE_SECRET_KEY|CLOUDINARY_API_SECRET|WHATSAPP_ACCESS_TOKEN|RESEND_API_KEY/);
  assert.match(page, /Read-only checks/);
  assert.match(page, /do not send messages, create payments or upload files/);
});
