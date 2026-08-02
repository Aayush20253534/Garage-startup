const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("every web-app shell captures the install prompt before React starts", () => {
  for (const file of [
    "client/index.html",
    "client/admin.html",
    "client/intern.html",
    "client/garage.html",
    "client/support.html",
  ]) {
    const html = read(file);
    const bootstrapIndex = html.indexOf("/pwa-install-bootstrap.js");
    const appIndex = html.indexOf('/src/main.jsx');

    assert.ok(bootstrapIndex >= 0, `${file} must load the PWA bootstrap`);
    assert.ok(appIndex >= 0, `${file} must load the React entry point`);
    assert.ok(
      bootstrapIndex < appIndex,
      `${file} must capture beforeinstallprompt before React imports execute`,
    );
  }
});

test("all PWA manifests include install-compatible metadata and icons", () => {
  const manifests = [
    ["site.webmanifest", "/?pwa=customer", "/"],
    ["admin.webmanifest", "/admin?pwa=admin", "/admin"],
    ["intern.webmanifest", "/intern?pwa=intern", "/intern"],
    ["garage.webmanifest", "/garage?pwa=garage", "/garage"],
    ["support.webmanifest", "/support?pwa=support", "/support"],
  ];

  for (const [file, startUrl, scope] of manifests) {
    const manifest = JSON.parse(read(`client/public/${file}`));
    const sizes = new Set(manifest.icons.map((icon) => icon.sizes));

    assert.equal(manifest.start_url, startUrl);
    assert.equal(manifest.scope, scope);
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.prefer_related_applications, false);
    assert.ok(sizes.has("192x192"));
    assert.ok(sizes.has("512x512"));
  }
});

test("all service workers provide a navigation fetch handler and offline fallback", () => {
  for (const file of [
    "sw.js",
    "admin-sw.js",
    "intern-sw.js",
    "garage-sw.js",
    "support-sw.js",
  ]) {
    const worker = read(`client/public/${file}`);

    assert.match(worker, /self\.addEventListener\("fetch"/);
    assert.match(worker, /request\.mode !== "navigate"/);
    assert.match(worker, /OFFLINE_URL = "\/offline\.html"/);
    assert.match(worker, /SHELL_CACHE_PREFIX/);
  }
});

test("install UI consumes each browser prompt once and uses mobile-safe help rows", () => {
  const installCard = read("client/src/components/pwa/AppInstallCard.jsx");

  assert.match(installCard, /window\[promptKey\] = null;/);
  assert.match(installCard, /A BeforeInstallPromptEvent can be used only once/);
  assert.match(installCard, /grid-cols-\[28px_minmax\(0,1fr\)\]/);
  assert.match(installCard, /break-words/);
});

test("customer vehicle cards stay compact on mobile and warranty cards remain overflow safe", () => {
  const vehicles = read("client/src/pages/customer/MyVehicles.jsx");
  const warranties = read("client/src/pages/customer/WarrantyCenter.jsx");

  assert.match(vehicles, /aspect-\[16\/9\]/);
  assert.match(vehicles, /grid-cols-\[88px_minmax\(0,1fr\)\]/);
  assert.match(vehicles, /h-24[\s\S]*sm:aspect-\[16\/9\]/);
  assert.match(vehicles, /space-y-1\.5 text-xs sm:hidden/);
  assert.match(vehicles, /hidden min-w-0 grid-cols-2 gap-2 sm:grid/);
  assert.match(vehicles, /\[overflow-wrap:anywhere\]/);

  assert.match(warranties, /min-\[440px\]:flex-row/);
  assert.match(warranties, /break-all/);
  assert.match(warranties, /\[overflow-wrap:anywhere\]/);
  assert.match(warranties, /Claim warranty/);
});
