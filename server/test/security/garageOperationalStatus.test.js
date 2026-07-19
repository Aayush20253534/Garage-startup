const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("admins can enable and disable every garage from the garage list", () => {
  const routes = readProjectFile(
    "server/src/admin/routes/garageAdmin.routes.js",
  );
  const validation = readProjectFile(
    "server/src/admin/validations/garageAdmin.validation.js",
  );
  const api = readProjectFile("client/src/api/admin.js");
  const page = readProjectFile("client/src/pages/admin/Garages.jsx");

  assert.match(routes, /router\.patch\([\s\S]*"\/:garageId\/status"/);
  assert.match(routes, /authorizeRoles\("ADMIN"\)/);
  assert.match(validation, /body\("isActive"\)[\s\S]*\.isBoolean\(\)/);
  assert.match(api, /setGarageActiveStatus\(garageId, isActive\)/);
  assert.match(page, /All garage statuses/);
  assert.match(page, /Enabled garages/);
  assert.match(page, /Disabled garages/);
  assert.ok((page.match(/Disable garage/g) || []).length >= 2);
  assert.ok((page.match(/Enable garage/g) || []).length >= 2);
  assert.match(page, /rounded-md border px-3 text-xs font-bold/);
});

test("disabling a garage expires offers and refreshes customer search counts", () => {
  const service = readProjectFile(
    "server/src/admin/services/garageAdmin.service.js",
  );
  const statusStart = service.indexOf("const setGarageActiveStatus");
  const statusEnd = service.indexOf("const listAssignableServices", statusStart);

  assert.ok(statusStart >= 0, "setGarageActiveStatus must exist");
  assert.ok(statusEnd > statusStart, "setGarageActiveStatus must be bounded");

  const statusSource = service.slice(statusStart, statusEnd);

  assert.match(statusSource, /data: \{ isActive: nextIsActive \}/);
  assert.match(
    statusSource,
    /status: BROADCAST_STATUS\.SENT[\s\S]*status: BROADCAST_STATUS\.EXPIRED/,
  );
  assert.match(statusSource, /invalidateCustomerCache\(userId\)/);
  assert.match(statusSource, /deleteCache\("public:stats:v2"\)/);
  assert.doesNotMatch(
    statusSource,
    /garageOwner\.(?:update|updateMany|upsert|delete)/,
  );
});

test("disabled garages are excluded from matching, alerts, and acceptance", () => {
  const garageSearch = readProjectFile("server/src/services/garage.service.js");
  const garageRequests = readProjectFile(
    "server/src/services/garageRequest.service.js",
  );
  const whatsapp = readProjectFile(
    "server/src/services/garageWhatsapp.service.js",
  );

  assert.match(garageSearch, /Prisma\.sql`g\."isActive" = true`/);
  assert.match(
    garageSearch,
    /findNearbyEligibleGarages[\s\S]*where: \{[\s\S]*isActive: true/,
  );
  assert.match(garageRequests, /garage: \{ isActive: true \}/);
  assert.match(garageRequests, /activeGarageIds\.has\(request\.garage\?\.id\)/);
  assert.match(garageRequests, /operationalGarage\.count === 0/);
  assert.match(whatsapp, /canSendWhatsappToGarage/);
  assert.match(whatsapp, /id: garage\.id,[\s\S]*isActive: true/);
  assert.ok((whatsapp.match(/GARAGE_DISABLED/g) || []).length >= 1);
  assert.ok((whatsapp.match(/canSendWhatsappToGarage\(garage\)/g) || []).length >= 2);
});
