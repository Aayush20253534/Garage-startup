const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  garageCanServeBooking,
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

test("garage alerts recheck capability before WhatsApp and in-app delivery", () => {
  const requestService = readProjectFile(
    "server/src/services/garageRequest.service.js",
  );
  const eligibilityService = readProjectFile(
    "server/src/services/garage.service.js",
  );

  assert.match(requestService, /garageCanServeBooking/);
  assert.match(requestService, /supportedBrands: true/);
  assert.match(requestService, /serviceId: \{ in: requiredServiceIds \}/);
  assert.match(eligibilityService, /garageCanServeBooking\(\{/);
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
  assert.match(servicesPage, /Allocated vehicle coverage/);
  assert.match(servicesPage, /Unassigned catalogue services are never shown/);
});
