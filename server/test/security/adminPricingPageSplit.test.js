const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("admin pricing UI separates live ranges from pricing operations", () => {
  const app = read("client/src/App.jsx");
  const revenue = read("client/src/pages/admin/Revenue.jsx");
  const pricingOperations = read(
    "client/src/pages/admin/PricingOperations.jsx",
  );

  assert.match(
    app,
    /to: "\/admin\/pricing-operations"[\s\S]*?label: "Pricing Operations"/,
  );
  assert.match(app, /path="\/admin\/pricing-operations"/);
  assert.match(app, /<AdminPricingOperations \/>/);
  assert.match(pricingOperations, /<Revenue pageMode="operations" \/>/);

  assert.match(revenue, /const isOperationsPage = !isIntern && pageMode === "operations"/);
  assert.match(revenue, /const showCityDisplayPricing = isOperationsPage/);
  assert.match(revenue, /const showSubmissionSection = isIntern \|\| isOperationsPage/);
  assert.match(revenue, /const showLivePriceManagement = !isOperationsPage/);
  assert.match(revenue, /\{showCityDisplayPricing && \(/);
  assert.match(revenue, /\{showSubmissionSection && \(/);
  assert.match(revenue, /\{showLivePriceManagement && \(/);
  assert.match(revenue, /Pricing Operations/);
  assert.match(revenue, /City display pricing/);
  assert.match(revenue, /Intern Price Range Review/);
  assert.match(revenue, /Create a Live Price Range/);
});
