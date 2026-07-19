const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("signed-in mobile navigation replaces Home with the requested order", () => {
  const navbar = read("client/src/components/navbar/Navbar.jsx");
  const start = navbar.indexOf("const AUTHENTICATED_MOBILE_NAV");
  const end = navbar.indexOf("];", start) + 2;
  const authenticatedMobileNav = navbar.slice(start, end);

  const expectedPaths = [
    "/dashboard",
    "/services",
    "/dashboard/notifications",
    "/how-it-works",
    "/contact",
    "/about",
  ];
  const positions = expectedPaths.map((route) =>
    authenticatedMobileNav.indexOf(`to: "${route}"`),
  );

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  assert.doesNotMatch(authenticatedMobileNav, /to: "\/"/);
  assert.match(navbar, /const mobileNav = user \? AUTHENTICATED_MOBILE_NAV : NAV/);
  assert.match(navbar, /\{mobileNav\.map/);
});

test("desktop navigation remains unchanged and customer logout returns home", () => {
  const navbar = read("client/src/components/navbar/Navbar.jsx");
  const layout = read("client/src/layouts/DashboardLayout.jsx");

  assert.match(navbar, /const visibleNav = NAV/);
  assert.match(navbar, /className="hidden items-center gap-1 lg:flex"[\s\S]*\{visibleNav\.map/);
  assert.match(navbar, /finally \{[\s\S]*nav\("\/", \{ replace: true \}\)/);
  assert.match(layout, /navigate\("\/", \{ replace: true \}\)/);
});
