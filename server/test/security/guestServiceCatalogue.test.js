const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servicesPage = fs.readFileSync(
  path.join(__dirname, "../../../client/src/pages/Services.jsx"),
  "utf8",
);

test("logged-out catalogue renders individual services instead of category ranges", () => {
  assert.match(servicesPage, /const filteredGuestServices = useMemo/);
  assert.match(servicesPage, /filteredGuestServices\.map\(\(\{ category, service \}\)/);
  assert.match(
    servicesPage,
    /formatRupeeRange\(\s*service\.priceRange\.min,\s*service\.priceRange\.max,/,
  );
  assert.doesNotMatch(servicesPage, /categoryMinPrice|categoryMaxPrice/);
});

test("authenticated catalogue keeps the existing category branch", () => {
  assert.match(
    servicesPage,
    /user && filteredCategories\.length > 0/,
  );
  assert.match(servicesPage, /getServiceCategoryPath\(\s*category,/);
  assert.match(servicesPage, /View available services/);
});

test("guest service cards require login before booking", () => {
  assert.match(servicesPage, /to="\/login"/);
  assert.match(servicesPage, /Login to book/);
  assert.match(servicesPage, /Price unavailable for this vehicle/);
});
