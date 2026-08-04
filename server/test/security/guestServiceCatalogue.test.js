const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servicesPage = fs.readFileSync(
  path.join(__dirname, "../../../client/src/pages/Services.jsx"),
  "utf8",
);
const categoryDetailPage = fs.readFileSync(
  path.join(__dirname, "../../../client/src/pages/CategoryDetail.jsx"),
  "utf8",
);
const serviceController = fs.readFileSync(
  path.join(__dirname, "../../src/customer/controllers/service.controller.js"),
  "utf8",
);
const serviceValidation = fs.readFileSync(
  path.join(__dirname, "../../src/customer/validations/service.validation.js"),
  "utf8",
);

test("the services catalogue is category-first for guests and customers", () => {
  assert.doesNotMatch(servicesPage, /GuestServiceCard|filteredGuestServices/);
  assert.match(servicesPage, /filteredCategories\.length > 0/);
  assert.match(servicesPage, /Search service categories/);
  assert.match(servicesPage, /Vehicle service categories/);
});

test("price and vehicle filters live inside a selected category", () => {
  assert.doesNotMatch(servicesPage, /guest-price-filter-heading/);
  assert.match(categoryDetailPage, /category-price-filter-heading/);
  assert.match(categoryDetailPage, /loadActiveCities\(\)/);
  assert.match(categoryDetailPage, /api\.get\("\/vehicle-meta\/brands"\)/);
  assert.match(categoryDetailPage, /vehicleBrandId: guestBrandId/);
  assert.match(categoryDetailPage, /vehicleModelId: guestModelId/);
  assert.match(categoryDetailPage, /fuelType: guestFuelType/);
  assert.match(categoryDetailPage, /Search prices/);
  assert.match(categoryDetailPage, /guestFilterDraft/);
  assert.match(categoryDetailPage, /Complete all four fields/);
  assert.match(
    categoryDetailPage,
    /grid grid-cols-2[\s\S]*lg:grid-cols-4/,
    "guest filters should stay compact on mobile and preserve the desktop grid",
  );
  assert.match(
    categoryDetailPage,
    /h-10 w-full min-w-0[\s\S]*sm:h-12/,
    "guest filter controls should use mobile-sized heights with desktop fallbacks",
  );
  assert.match(
    categoryDetailPage,
    /mt-2 hidden items-center[\s\S]*sm:flex/,
    "the selected-model preview should not expand the mobile filter",
  );
  assert.match(serviceValidation, /query\("fuelType"\)/);
  assert.match(serviceController, /fuelType: req\.query\.fuelType/);
});

test("category cards keep routing to their service details", () => {
  assert.match(servicesPage, /getServiceCategoryPath\(\s*category,/);
  assert.match(servicesPage, /View available services/);
});

test("guest category services require login before booking", () => {
  assert.match(categoryDetailPage, /nav\("\/login"/);
  assert.match(categoryDetailPage, /Login to Book/);
  assert.match(categoryDetailPage, /Price not allocated for this vehicle/);
});
