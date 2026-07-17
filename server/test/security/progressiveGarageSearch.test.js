const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SEARCH_RADII_KM,
  getNextGarageSearchStage,
  selectGaragesForSearchStage,
} = require("../../src/services/garageSearchPlan");

test("garage search progresses through 5 km, 10 km, and 20 km", () => {
  assert.deepEqual(SEARCH_RADII_KM, [5, 10, 20]);

  assert.deepEqual(
    getNextGarageSearchStage({
      garageSearchRound: 0,
      garageSearchCycle: 1,
    }),
    { round: 1, cycle: 1, radiusKm: 5, restarting: false },
  );

  assert.deepEqual(
    getNextGarageSearchStage({
      garageSearchRound: 1,
      garageSearchCycle: 1,
    }),
    { round: 2, cycle: 1, radiusKm: 10, restarting: false },
  );

  assert.deepEqual(
    getNextGarageSearchStage({
      garageSearchRound: 2,
      garageSearchCycle: 1,
    }),
    { round: 3, cycle: 1, radiusKm: 20, restarting: false },
  );
});

test("garage search restarts from 5 km after the 20 km round", () => {
  assert.deepEqual(
    getNextGarageSearchStage({
      garageSearchRound: 3,
      garageSearchCycle: 4,
    }),
    { round: 1, cycle: 5, radiusKm: 5, restarting: true },
  );
});

test("a wider radius only alerts garages not already contacted in that cycle", () => {
  const eligibleGarages = [
    { id: "garage-1", distanceKm: 2 },
    { id: "garage-2", distanceKm: 7 },
    { id: "garage-3", distanceKm: 9 },
  ];

  const selected = selectGaragesForSearchStage({
    eligibleGarages,
    previousRequests: [
      { garageId: "garage-1", searchCycle: 2 },
      { garageId: "garage-2", searchCycle: 1 },
    ],
    searchCycle: 2,
  });

  assert.deepEqual(
    selected.map((garage) => garage.id),
    ["garage-2", "garage-3"],
  );
});

test("a new cycle may contact nearby garages again", () => {
  const selected = selectGaragesForSearchStage({
    eligibleGarages: [{ id: "garage-1", distanceKm: 2 }],
    previousRequests: [{ garageId: "garage-1", searchCycle: 1 }],
    searchCycle: 2,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, "garage-1");
});

const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "../../..", relativePath), "utf8");

test("garage request integration uses the persisted radius and no batch cap", () => {
  const source = readProjectFile("server/src/services/garageRequest.service.js");

  assert.match(source, /maxDistance: searchStage\.radiusKm/);
  assert.match(source, /selectGaragesForSearchStage/);
  assert.doesNotMatch(source, /GARAGE_SEARCH_BATCH_SIZE/);
  assert.match(source, /invalidateBookingReadCaches\(booking\.userId\)/);
});

test("checkout uses the selected saved address without reading customer GPS", () => {
  const source = readProjectFile("client/src/pages/booking/Checkout.jsx");
  const selectedLocationIndex = source.indexOf(
    "const selectedLocationPayload = await toPayload(location)",
  );
  const savedLocationIndex = source.indexOf(
    "const defaultUserLocation = getDefaultUserLocation(user)",
    selectedLocationIndex,
  );

  assert.ok(selectedLocationIndex >= 0);
  assert.ok(savedLocationIndex > selectedLocationIndex);
  assert.doesNotMatch(source, /navigator\.geolocation/);
  assert.doesNotMatch(source, /getLiveCheckoutLocation/);
  assert.doesNotMatch(source, /showCurrentLocation/);
});

test("garage navigation keeps using the address stored on the booking", () => {
  const source = readProjectFile("client/src/pages/garage/BookingDetail.jsx");

  assert.match(source, /const \{ lat, lng \} = booking\.customer\.location/);
  assert.match(source, /center=\{booking\.customer\.location\}/);
});

test("tracking explains the 20 km retry without another payment", () => {
  const source = readProjectFile("client/src/pages/booking/Tracking.jsx");

  assert.match(source, /No verified garage accepted within 20 km/);
  assert.match(source, /No additional payment or action is required/);
  assert.match(source, /Matching in progress · \{searchRadiusKm\} km/);
});
