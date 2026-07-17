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
