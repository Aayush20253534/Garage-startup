const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("controller creation is visibly phone-first and sends no blank email", () => {
  const management = read("client/src/components/garage/ControllerManagement.jsx");
  const validation = read("server/src/garage/validations/controller.validation.js");
  const service = read("server/src/garage/services/controller.service.js");
  const schema = read("server/prisma/schema.prisma");

  assert.match(management, /Phone number[\s\S]*Primary login ID and booking-alert number/);
  assert.match(management, /Email[\s\S]*\(optional\)/);
  assert.match(management, /email: form\.email\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(management, /name="controllerEmail"[\s\S]{0,120}required/);
  assert.match(validation, /body\("email"\)[\s\S]*optional\(\{ checkFalsy: true \}\)/);
  assert.match(service, /const email = cleanOptionalEmail\(input\.email\)/);
  assert.match(schema, /model GarageController \{[\s\S]*email\s+String\?/);
});

test("garage owner and controller service history is scoped and includes full evidence", () => {
  const routes = read("server/src/routes/garageRequest.routes.js");
  const controller = read("server/src/controllers/garageRequest.controller.js");
  const service = read("server/src/services/garageRequest.service.js");
  const api = read("client/src/api/garage.js");
  const app = read("client/src/App.jsx");
  const page = read("client/src/pages/garage/ServiceHistory.jsx");

  assert.match(routes, /"\/service-history"[\s\S]*serviceHistoryQuerySchema[\s\S]*garageRequestController\.getGarageServiceHistory/);
  assert.match(controller, /getGarageServiceHistory[\s\S]*getGarageAccess\(req\.user\)/);
  assert.match(service, /status: BOOKING_STATUS\.COMPLETED/);
  assert.match(service, /\.\.\.\(controllerId \? \{ garageControllerId: controllerId \} : \{\}\)/);
  assert.match(service, /inspectionImages:[\s\S]*mediaType/);
  assert.match(service, /events:[\s\S]*actorName/);
  assert.match(api, /getServiceHistory/);
  assert.match(app, /\/garage\/history/);
  assert.match(page, /Service History/);
  assert.match(page, /InspectionGallery/);
  assert.match(page, /Pickup inspection photos and videos/);
  assert.match(page, /Delivery photos and videos/);
  assert.match(page, /break-all/);
  assert.match(page, /min-w-0/);
});
