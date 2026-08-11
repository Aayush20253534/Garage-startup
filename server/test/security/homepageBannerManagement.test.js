const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("homepage banner management is limited to admins and validates uploads", () => {
  const routes = read("server/src/admin/routes/homepageBanner.routes.js");
  assert.match(routes, /authorizeRoles\("ADMIN", "SUB_ADMIN"\)/);
  assert.match(routes, /fileSize: 8 \* 1024 \* 1024/);
  assert.match(routes, /duration.*isInt\(\{ min: 1, max: 300 \}\)/s);
  assert.match(routes, /router\.put\(\s*"\/order"/s);
  assert.match(routes, /router\.delete\("\/:bannerId"/);
});

test("public homepage banners expose only active presentation data", () => {
  const service = read("server/src/admin/services/homepageBanner.service.js");
  assert.match(service, /where: \{ isActive: true \}/);
  assert.match(service, /heading: true/);
  assert.match(service, /description: true/);
  assert.match(service, /homepageBannerSetting\.upsert/);
  assert.doesNotMatch(
    service.match(/const listActiveBanners[\s\S]*?const createBanner/)?.[0] || "",
    /title: true|publicId: true/,
  );
});

test("homepage rotates active banners and keeps the original image fallback", () => {
  const home = read("client/src/pages/Home.jsx");
  const admin = read("client/src/pages/admin/HomepageBanners.jsx");
  assert.match(home, /\/public\/homepage-banners/);
  assert.match(home, /homepageBannerDuration \* 1000/);
  assert.match(home, /activeBanner\.heading/);
  assert.match(home, /activeBanner\.description/);
  assert.match(home, /HOMEPAGE_HERO_DESKTOP/);
  assert.match(admin, /Deactivate/);
  assert.match(admin, /Activate/);
  assert.match(admin, /Permanently delete/);
  assert.match(admin, /FiArrowUp/);
  assert.match(admin, /FiArrowDown/);
  assert.match(admin, /Save duration/);
  assert.match(admin, /updateHomepageBannerDuration/);
  assert.match(admin, /Public heading/);
  assert.match(admin, /Public description/);
});
