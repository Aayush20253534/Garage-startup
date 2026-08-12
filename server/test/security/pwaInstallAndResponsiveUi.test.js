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

test("customer PWA uses the full Rovauto brand lockup and refreshes installed apps", () => {
  const manifest = JSON.parse(read("client/public/site.webmanifest"));
  const index = read("client/index.html");
  const installCard = read("client/src/components/pwa/CustomerPwaInstall.jsx");
  const workerRegistration = read("client/src/utils/imageCache.js");
  const worker = read("client/public/sw.js");
  const offline = read("client/public/offline.html");
  const iconSources = new Set(manifest.icons.map((icon) => icon.src));

  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/?pwa=customer");
  assert.ok(iconSources.has("/rovauto-brand-v3-icon-192.png"));
  assert.ok(iconSources.has("/rovauto-brand-v3-icon-512.png"));
  assert.ok(iconSources.has("/rovauto-brand-v3-icon-maskable-512.png"));
  assert.match(index, /site\.webmanifest\?v=20260808-brand-v3/);
  assert.match(index, /rovauto-brand-v3-apple-touch-icon\.png/);
  assert.match(installCard, /rovauto-brand-v3-icon-512\.png/);
  assert.match(worker, /rovauto-customer-shell-v3/);
  assert.match(worker, /rovauto-brand-v3-icon-512\.png/);
  assert.match(offline, /rovauto-brand-lockup-v3\.png/);
  assert.match(offline, /Gaadi Apki Guarantee hamari/);

  // Existing installed PWAs must check for the just-deployed worker without
  // asking the customer to uninstall/reinstall the app.
  assert.match(workerRegistration, /updateViaCache: "none"/);
  assert.match(workerRegistration, /registration\.update\(\)/);
  assert.match(workerRegistration, /window\.addEventListener\("pageshow", checkForUpdate\)/);
  assert.match(workerRegistration, /window\.addEventListener\("online", checkForUpdate\)/);
  assert.match(workerRegistration, /document\.addEventListener\("visibilitychange", checkWhenVisible\)/);
  assert.match(workerRegistration, /controllerchange/);

  for (const icon of [
    "rovauto-brand-v3-icon-192.png",
    "rovauto-brand-v3-icon-512.png",
    "rovauto-brand-v3-icon-1024.png",
    "rovauto-brand-v3-icon-maskable-512.png",
    "rovauto-brand-v3-icon-maskable-1024.png",
    "rovauto-brand-v3-apple-touch-icon.png",
    "rovauto-brand-lockup-v3.png",
  ]) {
    assert.equal(
      fs.existsSync(path.join(root, "client/public", icon)),
      true,
      `${icon} must ship with the customer PWA`,
    );
  }
});


test("admin, intern, garage and support PWAs use role-specific Rovauto branding and update in place", () => {
  const portals = ["admin", "intern", "garage", "support"];

  for (const portal of portals) {
    const manifest = JSON.parse(read(`client/public/${portal}.webmanifest`));
    const html = read(`client/${portal}.html`);
    const worker = read(`client/public/${portal}-sw.js`);
    const iconSources = new Set(manifest.icons.map((icon) => icon.src));

    assert.equal(manifest.background_color, "#ffffff");
    assert.equal(manifest.theme_color, "#111111");
    assert.ok(iconSources.has(`/${portal}-brand-v4-icon-192.png`));
    assert.ok(iconSources.has(`/${portal}-brand-v4-icon-512.png`));
    assert.ok(iconSources.has(`/${portal}-brand-v4-icon-maskable-512.png`));
    assert.match(
      html,
      new RegExp(`${portal}\\.webmanifest\\?v=20260808-role-brand-v4`),
    );
    assert.match(
      html,
      new RegExp(`${portal}-brand-v4-apple-touch-icon\\.png`),
    );
    assert.match(worker, new RegExp(`rovauto-${portal}-shell-v2`));
    assert.match(
      worker,
      new RegExp(`${portal}-brand-v4-icon-512\\.png`),
    );
  }

  // Keep each manifest ID/scope stable so an already-installed PWA is updated
  // in place rather than becoming a second application that needs reinstalling.
  assert.equal(JSON.parse(read("client/public/admin.webmanifest")).id, "/admin-app");
  assert.equal(JSON.parse(read("client/public/intern.webmanifest")).id, "/intern-app");
  assert.equal(JSON.parse(read("client/public/garage.webmanifest")).id, "/garage-app");
  assert.equal(JSON.parse(read("client/public/support.webmanifest")).id, "/support-app");
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

  assert.match(vehicles, /h-14 w-20 shrink-0/);
  assert.match(vehicles, /object-cover/);
  assert.match(vehicles, /grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4/);
  assert.match(vehicles, /min-w-0 max-w-6xl/);
  assert.match(vehicles, /grid grid-cols-2 gap-2/);
  assert.match(vehicles, /break-words/);

  assert.match(warranties, /min-\[440px\]:flex-row/);
  assert.match(warranties, /break-all/);
  assert.match(warranties, /\[overflow-wrap:anywhere\]/);
  assert.match(warranties, /Claim warranty/);
});
