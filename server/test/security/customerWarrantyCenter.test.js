const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("public mock warranty page stays available while customer portal gets a real page", () => {
  const app = read("client/src/App.jsx");
  const publicWarranty = read("client/src/pages/Warranty.jsx");
  const customerWarranty = read("client/src/pages/customer/WarrantyCenter.jsx");

  assert.match(app, /path="\/warranty" element={<Warranty \/>}/);
  assert.match(app, /to: "\/dashboard\/warranty", label: "Warranty Center"/);
  assert.match(app, /path="\/dashboard\/warranty"[\s\S]*<CustomerWarrantyCenter \/>/);
  assert.match(publicWarranty, /const CARDS = \[/);
  assert.match(customerWarranty, /warrantyApi\.listMyWarranties\(\)/);
});

test("customer warranty endpoint is customer-authenticated and derived from completed bookings", () => {
  const routeIndex = read("server/src/routes/index.routes.js");
  const routes = read("server/src/customer/routes/warranty.routes.js");
  const service = read("server/src/customer/services/warranty.service.js");
  const warrantyUtils = read("server/src/customer/services/warranty.utils.js");

  assert.match(
    routeIndex,
    /router\.use\("\/warranties", protectUser, requireCustomer, warrantyRoutes\)/,
  );
  assert.match(routes, /router\.get\("\/", warrantyController\.getMyWarranties\)/);
  assert.match(service, /status: "COMPLETED"/);
  assert.match(service, /garageId: \{ not: null \}/);
  assert.match(warrantyUtils, /WARRANTY_DURATION_DAYS = 30/);
  assert.match(warrantyUtils, /Math\.max\(0, Math\.ceil\(remainingMs \/ DAY_IN_MS\)\)/);
  assert.match(warrantyUtils, /status: isActive \? "ACTIVE" : "EXPIRED"/);
});

test("real warranty cards show selected services, vehicle, garage, and live remaining days", () => {
  const customerWarranty = read("client/src/pages/customer/WarrantyCenter.jsx");

  assert.match(customerWarranty, /Services selected/);
  assert.match(customerWarranty, /getVehicleName\(warranty\.vehicle\)/);
  assert.match(customerWarranty, /warranty\.garage\?\.name/);
  assert.match(customerWarranty, /daysRemaining/);
  assert.match(customerWarranty, /60 \* 1000/);
  assert.match(customerWarranty, /This 30-day service warranty has ended/);
  assert.match(customerWarranty, /bg-gradient-to-br from-ink to-ink-2/);
});
