const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("customers cannot browse garages before a booking is accepted", () => {
  const app = read("client/src/App.jsx");
  const home = read("client/src/pages/Home.jsx");
  const navbar = read("client/src/components/navbar/Navbar.jsx");
  const preload = read("client/src/utils/customerPreload.js");
  const garageRoutes = read("server/src/routes/garage.routes.js");

  assert.doesNotMatch(app, /path="\/garages"/);
  assert.doesNotMatch(app, /path="\/booking\/garage"/);
  assert.doesNotMatch(home, /to=\{user \? garagesPath/);
  assert.doesNotMatch(navbar, /to: "\/garages"/);
  assert.doesNotMatch(preload, /"\/booking\/garage"/);
  assert.doesNotMatch(garageRoutes, /router\.get\("\/"/);
  assert.doesNotMatch(garageRoutes, /"\/nearby"/);
  assert.doesNotMatch(garageRoutes, /router\.get\("\/:id"/);
});

test("accepted bookings expose a price-free garage cover and capability details", () => {
  const bookingService = read(
    "server/src/customer/services/booking.service.js",
  );
  const dashboardService = read(
    "server/src/customer/services/dashboard.service.js",
  );
  const garageCard = read(
    "client/src/components/booking/AcceptedGarageCard.jsx",
  );
  const activeBookings = read("client/src/pages/customer/ActiveBookings.jsx");
  const dashboard = read("client/src/pages/customer/Dashboard.jsx");
  const tracking = read("client/src/pages/booking/Tracking.jsx");
  const broadcastsStart = bookingService.indexOf("broadcasts:");
  const reviewStart = bookingService.indexOf("review:", broadcastsStart);
  const broadcastsInclude = bookingService.slice(broadcastsStart, reviewStart);

  assert.match(bookingService, /garage:\s*\{[\s\S]*images:[\s\S]*services:/);
  assert.match(dashboardService, /garage:\s*\{[\s\S]*images:[\s\S]*services:/);
  assert.match(bookingService, /vehicleBrand: true,[\s\S]*vehicleModel: true/);
  assert.doesNotMatch(broadcastsInclude, /garage/);
  assert.match(garageCard, /Services provided/);
  assert.match(garageCard, /Vehicles catered/);
  assert.match(garageCard, /Open in Maps/);
  assert.doesNotMatch(garageCard, /estimatedPrice|finalPrice|price:/);
  assert.match(activeBookings, /AcceptedGarageCard garage=\{booking\.garage\}/);
  assert.match(dashboard, /AcceptedGarageCard[\s\S]*garage=\{activeBooking\.garage\}/);
  assert.match(tracking, /AcceptedGarageCard garage=\{booking\.garage\}/);
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
  assert.match(trackingService, /TRACKING_PHASE\.RETURN_TO_GARAGE/);
  assert.match(trackingService, /latitude: booking\.garage\.latitude/);
  assert.match(trackingService, /latitude: booking\.customerLatitude/);
  assert.match(trackingService, /journeyPhase/);
  assert.match(
    trackingService,
    /lastGarageLatitude: rawLocation\.latitude,[\s\S]*lastGarageLongitude: rawLocation\.longitude/,
  );
  assert.match(
    mapRoutes,
    /tracking\/location"[\s\S]*authorizeRoles\("CUSTOMER", "GARAGE_OWNER", "GARAGE_CONTROLLER", "ADMIN", "SUB_ADMIN"\)/,
  );
  assert.match(
    trackingService,
    /account\.role === "CUSTOMER"[\s\S]*bookingUsesSelfDropOff\(booking\)[\s\S]*booking\.userId === account\.id/,
  );
  assert.match(
    trackingService,
    /account\.role === "GARAGE_CONTROLLER"[\s\S]*booking\.garageControllerId === account\.id/,
  );
  assert.match(mapPanel, /maps\.importLibrary\("geometry"\)/);
  assert.match(mapPanel, /geometry\.encoding\.decodePath\(encodedPolyline\)/);
  assert.doesNotMatch(mapPanel, /new maps\.DirectionsService\(\)/);
  assert.doesNotMatch(mapPanel, /new maps\.DirectionsRenderer/);
  assert.match(trackingService, /googleMapsService\.computeRoute/);
  assert.match(trackingService, /routePolyline: route\.encodedPolyline/);
});
