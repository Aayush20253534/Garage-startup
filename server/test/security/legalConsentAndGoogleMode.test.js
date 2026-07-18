const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(__dirname, "../..", relative), "utf8");

test("customer signup requires both legal consents in UI and backend", () => {
  const register = read("../client/src/pages/auth/Register.jsx");
  const validation = read("src/customer/validations/auth.validation.js");
  const service = read("src/customer/services/auth.service.js");
  assert.match(register, /acceptedTerms/);
  assert.match(register, /acceptedPrivacy/);
  assert.match(register, /terms-and-conditions/);
  assert.match(register, /privacy-policy/);
  assert.match(validation, /value === true/);
  assert.match(service, /termsAcceptedAt/);
  assert.match(service, /privacyAcceptedAt/);
});

test("Google login cannot create accounts while Google signup requires consent", () => {
  const service = read("src/customer/services/auth.service.js");
  const googleClient = read("../client/src/utils/googleAuth.js");
  assert.match(service, /mode === "LOGIN"/);
  assert.match(service, /GOOGLE_SIGNUP_REQUIRED/);
  assert.match(service, /authProvider !== "GOOGLE"/);
  assert.match(googleClient, /mode: options\.mode \|\| "LOGIN"/);
});

test("admins have full garage detail and per-photo management routes", () => {
  const routes = read("src/admin/routes/garageAdmin.routes.js");
  const adminUi = read("../client/src/pages/admin/Garages.jsx");
  assert.match(routes, /updateGarageDetails/);
  assert.match(routes, /reorderGarageImages/);
  assert.match(routes, /setGarageThumbnail/);
  assert.match(adminUi, /Edit all details/);
  assert.match(adminUi, /Add photos/);
  assert.match(adminUi, /Set cover/);
  assert.match(adminUi, /deleteGaragePhoto/);
});
