const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("pricing operations can filter approval submissions by service, vehicle, and fuel", () => {
  const revenue = read("client/src/pages/admin/Revenue.jsx");

  assert.match(revenue, /const \[submissionServiceId, setSubmissionServiceId\]/);
  assert.match(revenue, /const \[submissionVehicleBrand, setSubmissionVehicleBrand\]/);
  assert.match(revenue, /const \[submissionVehicleModel, setSubmissionVehicleModel\]/);
  assert.match(revenue, /const \[submissionFuelType, setSubmissionFuelType\]/);
  assert.match(revenue, /buildSubmissionVehicleFilterOptions/);
  assert.match(revenue, /const statusFilteredSubmissions = submissions\.filter/);
  assert.match(revenue, /submission\.serviceId !== submissionServiceId/);
  assert.match(revenue, /submission\.vehicleBrand \|\| "ALL"/);
  assert.match(revenue, /submission\.vehicleModel \|\| "ALL"/);
  assert.match(revenue, /submission\.fuelType \|\| "ANY"/);

  assert.match(revenue, /aria-label="Filter submissions by service"/);
  assert.match(revenue, /aria-label="Filter submissions by vehicle brand"/);
  assert.match(revenue, /aria-label="Filter submissions by vehicle model"/);
  assert.match(revenue, /aria-label="Filter submissions by fuel type"/);
  assert.match(revenue, /All submitted brands/);
  assert.match(revenue, /All submitted models/);
  assert.match(revenue, /Any fuel/);
  assert.match(revenue, /Showing \{visibleSubmissions\.length\} of/);
  assert.match(revenue, /const clearSubmissionFilters = \(\) =>/);
});

test("submission filters are limited to pricing operations and keep bulk deletion safe", () => {
  const revenue = read("client/src/pages/admin/Revenue.jsx");

  assert.match(revenue, /\{isOperationsPage && \([\s\S]*?Filter approval submissions/);
  assert.match(revenue, /hasSubmissionFilters[\s\S]*?Clear filters to delete all/);
  assert.match(
    revenue,
    /Filters affect the review list only\. Approve all still processes/,
  );
});
