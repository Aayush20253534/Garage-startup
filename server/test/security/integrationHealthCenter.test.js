const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("system health gives admin, sub-admin and intern the same operational workspace", () => {
  const routes = read("server/src/admin/routes/integrationHealth.routes.js");
  const indexRoutes = read("server/src/routes/index.routes.js");
  const app = read("client/src/App.jsx");
  const layout = read("client/src/layouts/DashboardLayout.jsx");
  const dashboard = read("client/src/pages/admin/Dashboard.jsx");
  const api = read("client/src/api/admin.js");
  const combinedPage = read("client/src/pages/admin/SystemHealth.jsx");
  const integrationPage = read("client/src/pages/admin/IntegrationHealth.jsx");
  const issuePage = read("client/src/pages/admin/SystemIssues.jsx");
  const issueRoutes = read("server/src/admin/routes/systemIssue.routes.js");

  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /router\.use\(authorizeRoles\("ADMIN", "SUB_ADMIN", "INTERN"\)\)/);
  assert.match(indexRoutes, /"\/admin\/integration-health"/);
  assert.match(app, /label: "System Health"/);
  assert.match(app, /path="\/admin\/system-health"/);
  assert.match(app, /path="\/intern\/system-health"/);
  assert.match(app, /to: "\/intern\/system-health", label: "System Health"/);
  assert.match(app, /system-health\?view=integrations/);
  assert.match(app, /system-health\?view=issues/);
  assert.doesNotMatch(app, /label: "Integration Health"/);
  assert.doesNotMatch(app, /label: "System Issues"[^\n]*admin/);
  assert.match(layout, /item\.to\.endsWith\("\/system-health"\)/);
  assert.match(dashboard, /admin\/system-health\?view=issues/);
  assert.match(api, /getIntegrationHealth/);
  assert.match(combinedPage, /System Health/);
  assert.match(combinedPage, /<IntegrationHealth embedded \/>/);
  assert.match(combinedPage, /<SystemIssues embedded \/>/);
  assert.doesNotMatch(combinedPage, /user\?\.role === "ADMIN"|isMainAdmin/);
  assert.match(integrationPage, /Integration Health Center/);
  assert.match(integrationPage, /Run all checks/);
  assert.match(issuePage, /embedded = false/);
  assert.doesNotMatch(issuePage, /isIntern|read-only/i);
  assert.match(issuePage, /Staff note/);
  assert.match(issueRoutes, /authorizeRoles\("ADMIN", "SUB_ADMIN", "INTERN"\)/);
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
  assert.match(service, /Meta documents the single business-phone-number lookup/);
  assert.doesNotMatch(
    service,
    /fields:\s*["']display_phone_number,verified_name,quality_rating["']/,
  );
  assert.match(service, /metadataAvailable/);
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
