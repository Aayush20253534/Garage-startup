const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildPricingCoverageReport,
  rangeCoversScope,
} = require("../../src/admin/services/pricingCoverage.service");

const fixtures = {
  cities: [{ id: "city-1", name: "Prayagraj", normalizedName: "prayagraj" }],
  services: [
    { id: "service-1", name: "Standard Service", category: { name: "Servicing" } },
    { id: "service-2", name: "Inspection", category: { name: "Diagnosis" } },
  ],
  brands: [
    {
      id: "brand-1",
      name: "Tata",
      models: [
        { id: "model-1", name: "Altroz", isActive: true },
        { id: "model-2", name: "Nexon", isActive: true },
      ],
    },
  ],
  ranges: [
    {
      city: "prayagraj",
      serviceId: "service-1",
      vehicleBrand: "Tata",
      vehicleModel: "Nexon",
      fuelType: "PETROL",
      isActive: true,
    },
    {
      city: "prayagraj",
      serviceId: "service-1",
      vehicleBrand: "Tata",
      vehicleModel: null,
      fuelType: "DIESEL",
      isActive: true,
    },
  ],
};

test("coverage report lists untouched services and exact brand/model/fuel gaps", () => {
  const report = buildPricingCoverageReport(fixtures, { limit: 500 });

  assert.equal(report.totals.untouchedServices, 1);
  assert.deepEqual(report.untouchedServices.map((item) => item.id), ["service-2"]);
  assert.equal(report.totals.modelFuelGaps, 21);
  assert.equal(report.totals.coveredModelFuelScopes, 3);
  assert.equal(report.totals.brandFuelGaps, 11);

  const petrolGap = report.brandFuelGaps.find(
    (item) => item.serviceId === "service-1" && item.fuelType === "PETROL",
  );
  assert.equal(petrolGap.missingModels, 1);
  assert.equal(petrolGap.totalModels, 2);

  assert.equal(
    report.modelFuelGaps.some(
      (item) =>
        item.serviceId === "service-1" &&
        item.vehicleModel === "Nexon" &&
        item.fuelType === "PETROL",
    ),
    false,
  );
  assert.equal(
    report.modelFuelGaps.some(
      (item) =>
        item.serviceId === "service-1" &&
        item.vehicleModel === "Altroz" &&
        item.fuelType === "PETROL",
    ),
    true,
  );
});

test("coverage honours ALL brand, ALL model, and any-fuel fallback ranges", () => {
  const wildcardRange = {
    city: "prayagraj",
    serviceId: "service-1",
    vehicleBrand: null,
    vehicleModel: null,
    fuelType: null,
  };

  assert.equal(
    rangeCoversScope(wildcardRange, {
      city: "Prayagraj",
      serviceId: "service-1",
      vehicleBrand: "Tata",
      vehicleModel: "Nexon",
      fuelType: "ELECTRIC",
    }),
    true,
  );

  const report = buildPricingCoverageReport(
    { ...fixtures, ranges: [wildcardRange] },
    { serviceId: "service-1", vehicleBrand: "Tata", limit: 500 },
  );

  assert.equal(report.resultMeta.filteredModelFuelGapCount, 0);
  assert.equal(report.modelFuelGaps.length, 0);
});

test("coverage filters return only the requested city, service, brand, and fuel", () => {
  const report = buildPricingCoverageReport(fixtures, {
    city: "Prayagraj",
    serviceId: "service-1",
    vehicleBrand: "Tata",
    fuelType: "PETROL",
    limit: 500,
  });

  assert.equal(report.resultMeta.filteredModelFuelGapCount, 1);
  assert.equal(report.modelFuelGaps.length, 1);
  assert.equal(report.modelFuelGaps[0].vehicleModel, "Altroz");
  assert.equal(report.modelFuelGaps[0].fuelType, "PETROL");
});

test("coverage uses observed vehicle fuel combinations before falling back to all fuels", () => {
  const report = buildPricingCoverageReport(
    {
      ...fixtures,
      ranges: [],
      vehicleFuelScopes: [
        { brand: "Tata", model: "Altroz", fuelType: "PETROL" },
        { brand: "Tata", model: "Nexon", fuelType: "ELECTRIC" },
      ],
    },
    { serviceId: "service-1", vehicleBrand: "Tata", limit: 500 },
  );

  assert.equal(report.totals.totalModelFuelScopes, 4);
  assert.equal(report.resultMeta.filteredModelFuelGapCount, 2);
  assert.deepEqual(
    report.modelFuelGaps.map((item) => `${item.vehicleModel}:${item.fuelType}`).sort(),
    ["Altroz:PETROL", "Nexon:ELECTRIC"],
  );
});
