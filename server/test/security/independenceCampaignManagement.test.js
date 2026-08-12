const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Independence campaign is admin controlled and mutually exclusive", () => {
  const routes = read("server/src/admin/routes/independenceCampaign.routes.js");
  const service = read("server/src/admin/services/independenceCampaign.service.js");
  assert.match(routes, /authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(routes, /\["OFF", "MANUAL", "SCHEDULED"\]/);
  assert.match(service, /mode === "MANUAL"/);
  assert.match(service, /mode !== "SCHEDULED"/);
  assert.match(service, /startsAt: null, endsAt: null/);
  assert.match(service, /manualEnabled: false, startsAt, endsAt/);
  assert.match(service, /current\.mode !== "OFF"/);
  assert.match(service, /Deactivate.*mode before enabling/);
});

test("public homepage uses only campaign status and keeps five second rotation", () => {
  const home = read("client/src/pages/Home.jsx");
  const publicRoutes = read("server/src/routes/public.routes.js");
  assert.match(publicRoutes, /independence-campaign/);
  assert.match(home, /\/public\/independence-campaign/);
  assert.match(home, /5 \* 1000/);
  assert.match(home, /independenceCampaignActive \? getHeroBanner/);
  assert.match(home, /INDEPENDENCE_BUTTON_CLASS/);
});
