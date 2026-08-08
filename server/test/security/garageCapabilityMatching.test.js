const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  assignmentMatchesVehicle,
  garageCanServeBooking,
  garageExcludesVehicleBrand,
  garageSupportsFulfillmentType,
} = require("../../src/utils/garageCapabilities");

const projectRoot = path.resolve(__dirname, "../../..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

const capableGarage = {
  supportedBrands: ["Ford", "Honda"],
  services: [
    {
      serviceId: "service-oil",
      vehicleBrand: "ALL",
      vehicleModel: "ALL",
      isActive: true,
      service: { isActive: true, category: { isActive: true } },
    },
    {
      serviceId: "service-brakes",
      vehicleBrand: "Ford",
      vehicleModel: "EcoSport",
      isActive: true,
      service: { isActive: true, category: { isActive: true } },
    },
  ],
};

test("garage capability matching requires every assigned service and supported brand", () => {
  assert.equal(
    garageCanServeBooking({
      garage: capableGarage,
      serviceIds: ["service-oil", "service-brakes"],
      vehicle: { brand: "ford", model: "ecosport" },
    }),
    true,
  );

  assert.equal(
    garageCanServeBooking({
      garage: capableGarage,
      serviceIds: ["service-oil", "service-tyres"],
      vehicle: { brand: "Ford", model: "EcoSport" },
    }),
    false,
  );

  assert.equal(
    garageCanServeBooking({
      garage: capableGarage,
      serviceIds: ["service-oil"],
      vehicle: { brand: "Toyota", model: "Innova" },
    }),
    false,
  );
});


test("garage handover capability must match the customer-selected booking mode", () => {
  const pickupGarage = { ...capableGarage, fulfillmentMode: "PICKUP_DELIVERY" };
  const selfDropGarage = { ...capableGarage, fulfillmentMode: "SELF_DROP_OFF" };
  const bothGarage = { ...capableGarage, fulfillmentMode: "BOTH" };

  assert.equal(
    garageSupportsFulfillmentType(pickupGarage, "PICKUP_DELIVERY"),
    true,
  );
  assert.equal(
    garageSupportsFulfillmentType(pickupGarage, "SELF_DROP_OFF"),
    false,
  );
  assert.equal(
    garageSupportsFulfillmentType(selfDropGarage, "PICKUP_DELIVERY"),
    false,
  );
  assert.equal(
    garageCanServeBooking({
      garage: bothGarage,
      serviceIds: ["service-oil"],
      vehicle: { brand: "Ford", model: "EcoSport" },
      fulfillmentType: "SELF_DROP_OFF",
    }),
    true,
  );
});

test("brand and model scoped assignments cannot receive unrelated alerts", () => {
  assert.equal(
    garageCanServeBooking({
      garage: capableGarage,
      serviceIds: ["service-brakes"],
      vehicle: { brand: "Honda", model: "City" },
    }),
    false,
  );

  assert.equal(
    garageCanServeBooking({
      garage: capableGarage,
      serviceIds: ["service-brakes"],
      vehicle: { brand: "Ford", model: "Figo" },
    }),
    false,
  );
});

test("brand and model exclusions override broader service allocations", () => {
  const activeService = {
    isActive: true,
    service: { isActive: true, category: { isActive: true } },
  };
  const garageWithExclusions = {
    supportedBrands: ["Ford", "Honda"],
    services: [
      {
        ...activeService,
        serviceId: "service-oil",
        vehicleBrand: "ALL",
        vehicleModel: "ALL",
        isExcluded: false,
      },
      {
        ...activeService,
        serviceId: "service-oil",
        vehicleBrand: "Ford",
        vehicleModel: "ALL",
        isExcluded: true,
      },
      {
        ...activeService,
        serviceId: "service-oil",
        vehicleBrand: "Honda",
        vehicleModel: "City",
        isExcluded: true,
      },
    ],
  };

  assert.equal(
    garageCanServeBooking({
      garage: garageWithExclusions,
      serviceIds: ["service-oil"],
      vehicle: { brand: "Ford", model: "EcoSport" },
    }),
    false,
  );
  assert.equal(
    garageCanServeBooking({
      garage: garageWithExclusions,
      serviceIds: ["service-oil"],
      vehicle: { brand: "Honda", model: "City" },
    }),
    false,
  );
  assert.equal(
    garageCanServeBooking({
      garage: garageWithExclusions,
      serviceIds: ["service-oil"],
      vehicle: { brand: "Honda", model: "Amaze" },
    }),
    true,
  );
  assert.equal(
    assignmentMatchesVehicle(
      {
        ...activeService,
        vehicleBrand: "Ford",
        vehicleModel: "ALL",
        isExcluded: true,
      },
      { brand: "Ford", model: "EcoSport" },
    ),
    false,
  );
});

test("multiple garage-wide brand exclusions block every allocated service", () => {
  const garage = {
    supportedBrands: ["ALL"],
    excludedServiceBrands: ["BMW", "Audi", "Mercedes"],
    services: [
      {
        serviceId: "service-ac",
        vehicleBrand: "ALL",
        vehicleModel: "ALL",
        isExcluded: false,
        isActive: true,
        service: { isActive: true, category: { isActive: true } },
      },
    ],
  };

  ["BMW", "audi", "MERCEDES"].forEach((brand) => {
    assert.equal(
      garageCanServeBooking({
        garage,
        serviceIds: ["service-ac"],
        vehicle: { brand, model: "Any model" },
      }),
      false,
    );
    assert.equal(garageExcludesVehicleBrand(garage, { brand }), true);
  });

  assert.equal(
    garageCanServeBooking({
      garage,
      serviceIds: ["service-ac"],
      vehicle: { brand: "Honda", model: "City" },
    }),
    true,
  );
});

test("garage assignment UI and queries preserve exclusion precedence", () => {
  const adminPage = readProjectFile("client/src/pages/admin/Garages.jsx");
  const garagePage = readProjectFile("client/src/pages/garage/Services.jsx");
  const customerGarageCard = readProjectFile(
    "client/src/components/booking/AcceptedGarageCard.jsx",
  );
  const adminService = readProjectFile(
    "server/src/admin/services/garageAdmin.service.js",
  );
  const eligibilityService = readProjectFile(
    "server/src/services/garage.service.js",
  );
  const schema = readProjectFile("server/prisma/schema.prisma");
  const migration = readProjectFile(
    "server/prisma/migrations/20260719110000_add_garage_service_exclusions/migration.sql",
  );
  const garageWideMigration = readProjectFile(
    "server/prisma/migrations/20260719120000_add_garage_wide_service_brand_exclusions/migration.sql",
  );
  const requestService = readProjectFile(
    "server/src/services/garageRequest.service.js",
  );

  assert.match(adminPage, /value="EXCLUDE">Exclude vehicle/);
  assert.match(adminPage, /isExcluded: serviceForm\.isExcluded/);
  assert.match(adminPage, /Entire brands/);
  assert.match(adminPage, /Specific models/);
  assert.match(adminPage, /vehicleScopes: exclusionScopes/);
  assert.match(adminPage, /garageServiceSaveInFlight\.current/);
  assert.match(adminPage, /if \(garageServiceSaveInFlight\.current\) return/);
  assert.match(adminPage, /savingGarageService \|\|/);
  assert.match(adminPage, /savingGarageService \? "Saving\.\.\." : "Save"/);
  assert.match(adminService, /const normalizeVehicleScope/);
  assert.match(adminService, /prisma\.\$transaction/);
  assert.match(adminService, /Choose specific vehicle brands to exclude/);
  assert.match(schema, /isExcluded\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /excludedServiceBrands\s+Json\s+@default\("\[\]"\)/);
  assert.match(migration, /ADD COLUMN "isExcluded" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(garageWideMigration, /ADD COLUMN "excludedServiceBrands" JSONB NOT NULL/);
  assert.match(eligibilityService, /excluded_gs\."isExcluded" = true/);
  assert.match(eligibilityService, /g\."excludedServiceBrands"/);
  assert.match(eligibilityService, /services:\s*\{\s*none:/);
  assert.match(requestService, /excludedServiceBrands: true/);
  assert.match(adminPage, /Garage-wide brand exclusions/);
  assert.match(adminPage, /editingGarageWideExclusions/);
  assert.match(adminPage, /Edit garage-wide brand exclusions/);
  assert.match(adminPage, /setEditingGarageWideExclusions\(false\)/);
  assert.match(garagePage, /Garage-wide excluded brands/);
  assert.match(garagePage, /Excluded: /);
  assert.match(customerGarageCard, /\.filter\(hasVehicleCoverage\)/);
});

test("garage alerts recheck capability before WhatsApp and in-app delivery", () => {
  const requestService = readProjectFile(
    "server/src/services/garageRequest.service.js",
  );
  const eligibilityService = readProjectFile(
    "server/src/services/garage.service.js",
  );

  assert.match(requestService, /garageCanServeBooking/);
  assert.match(requestService, /fulfillmentMode: true/);
  assert.match(requestService, /supportedBrands: true/);
  assert.match(requestService, /serviceId: \{ in: requiredServiceIds \}/);
  assert.match(eligibilityService, /garageCanServeBooking\(\{/);
  assert.match(eligibilityService, /g\."fulfillmentMode" IN/);
  assert.match(eligibilityService, /jsonb_array_elements_text/);
});

test("garage services page renders only grouped admin assignments", () => {
  const ownerService = readProjectFile(
    "server/src/garage/services/garageOwner.service.js",
  );
  const servicesPage = readProjectFile(
    "client/src/pages/garage/Services.jsx",
  );

  assert.match(ownerService, /garageId: garage\.id,[\s\S]*isActive: true/);
  assert.match(ownerService, /service:[\s\S]*isActive: true/);
  assert.match(servicesPage, /Assigned services/);
  assert.match(servicesPage, /Allocation rules/);
  assert.match(servicesPage, /safeAssignments\.forEach/);
  assert.match(servicesPage, /assignedServices\.map/);
});
