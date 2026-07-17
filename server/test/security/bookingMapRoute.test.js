const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("garage selection ranks and draws routes from the current booking location", () => {
  const garageSelect = read("client/src/pages/booking/GarageSelect.jsx");
  const routeCard = read("client/src/components/maps/RouteMapCard.jsx");
  const mapPanel = read("client/src/components/maps/MapPanel.jsx");
  const garageService = read("server/src/services/garage.service.js");

  assert.match(garageSelect, /latitude: Number\(location\.latitude\)/);
  assert.match(garageSelect, /longitude: Number\(location\.longitude\)/);
  assert.match(routeCard, /mapsApi[\s\S]*\.computeRoute\(/);
  assert.match(routeCard, /encodedPolyline=\{resolvedRoute\?\.encodedPolyline\}/);
  assert.match(mapPanel, /google\.com\/maps\/dir\/\?/);
  assert.match(
    garageService,
    /requestedLocation = getGeoSearchContext\(query,[\s\S]*searchOrigin = requestedLocation \|\| defaultLocation/,
  );
});

test("accepted booking tracking uses garage GPS and the fixed booking address", () => {
  const liveTracking = read(
    "client/src/components/maps/LiveBookingTracking.jsx",
  );
  const customerTracking = read("client/src/pages/booking/Tracking.jsx");
  const mapPanel = read("client/src/components/maps/MapPanel.jsx");
  const trackingService = read(
    "server/src/maps/services/bookingTracking.service.js",
  );
  const mapRoutes = read("server/src/maps/routes/maps.routes.js");

  assert.match(liveTracking, /navigator\.geolocation\.watchPosition/);
  assert.match(liveTracking, /maximumAge: 0/);
  assert.match(liveTracking, /TARGET_ACCURACY_METERS/);
  assert.doesNotMatch(customerTracking, /navigator\.geolocation/);
  assert.match(
    trackingService,
    /destination = \{[\s\S]*latitude: booking\.customerLatitude,[\s\S]*longitude: booking\.customerLongitude/,
  );
  assert.match(
    trackingService,
    /lastGarageLatitude: rawLocation\.latitude,[\s\S]*lastGarageLongitude: rawLocation\.longitude/,
  );
  assert.match(
    mapRoutes,
    /tracking\/location"[\s\S]*authorizeRoles\("GARAGE_OWNER", "ADMIN"\)/,
  );
  assert.match(mapPanel, /new maps\.DirectionsService\(\)/);
  assert.match(mapPanel, /new maps\.DirectionsRenderer/);
});
