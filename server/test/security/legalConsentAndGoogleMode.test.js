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

test("customer registration has independent password visibility controls", () => {
  const register = read("../client/src/pages/auth/Register.jsx");

  assert.match(register, /showPasswords\.password \? "text" : "password"/);
  assert.match(register, /showPasswords\.confirmPassword \? "text" : "password"/);
  assert.match(register, /togglePasswordVisibility\("password"\)/);
  assert.match(register, /togglePasswordVisibility\("confirmPassword"\)/);
  assert.match(register, /FiEyeOff/);
});

test("customer signup identities remain separate from garage owner identities", () => {
  const service = read("src/customer/services/auth.service.js");
  const identityHelperStart = service.indexOf("const findCustomerIdentity");
  const signupStart = service.indexOf("const signup", identityHelperStart);
  const identityHelper = service.slice(identityHelperStart, signupStart);

  assert.match(identityHelper, /prisma\.user\.findUnique/);
  assert.match(identityHelper, /email_role:[\s\S]*role: "CUSTOMER"/);
  assert.match(identityHelper, /phone_role:[\s\S]*role: "CUSTOMER"/);
  assert.doesNotMatch(identityHelper, /garageOwner/);
  assert.match(service, /customerByFirebaseUid[\s\S]*customerByEmail/);
});

test("mobile account cards replace the duplicate My Vehicles drawer button", () => {
  const navbar = read("../client/src/components/navbar/Navbar.jsx");
  const mobileDrawerStart = navbar.indexOf('className="fixed inset-0');
  const mobileDrawer = navbar.slice(mobileDrawerStart);
  const vehicleLinks = mobileDrawer.match(/to="\/dashboard\/vehicles"/g) || [];

  assert.match(mobileDrawer, /aria-label="Open My Vehicles"/);
  assert.match(mobileDrawer, /aria-label="Open customer profile"/);
  assert.match(mobileDrawer, /handleMobileNavigate\(event, "\/dashboard\/profile"\)/);
  assert.equal(vehicleLinks.length, 1);
});

test("Google login cannot create accounts while Google signup requires consent", () => {
  const service = read("src/customer/services/auth.service.js");
  const googleClient = read("../client/src/utils/googleAuth.js");
  const register = read("../client/src/pages/auth/Register.jsx");
  assert.match(service, /mode === "LOGIN"/);
  assert.match(service, /GOOGLE_SIGNUP_REQUIRED/);
  assert.match(service, /authProvider !== "GOOGLE"/);
  assert.match(googleClient, /mode: options\.mode \|\| "LOGIN"/);
  assert.match(register, /const \[googleConsentOpen, setGoogleConsentOpen\]/);
  assert.match(register, /onClick=\{openGoogleConsent\}/);
  assert.match(register, /aria-modal="true"/);
  assert.match(register, /onClick=\{handleGoogleAuth\}/);
  assert.match(register, /disabled=\{loading \|\| !acceptedTerms \|\| !acceptedPrivacy\}/);
});

test("admins have full garage detail and per-photo management routes", () => {
  const routes = read("src/admin/routes/garageAdmin.routes.js");
  const validation = read("src/admin/validations/garageAdmin.validation.js");
  const service = read("src/admin/services/garageAdmin.service.js");
  const adminUi = read("../client/src/pages/admin/Garages.jsx");
  assert.match(routes, /updateGarageDetails/);
  assert.match(routes, /reorderGarageImages/);
  assert.match(routes, /setGarageThumbnail/);
  assert.match(adminUi, /Edit all details/);
  assert.match(adminUi, /Add photos/);
  assert.match(adminUi, /Set cover/);
  assert.match(adminUi, /deleteGaragePhoto/);
  assert.match(adminUi, /ownerName/);
  assert.match(adminUi, /ownerEmail/);
  assert.match(adminUi, /ownerPhone/);
  assert.match(validation, /ownerName/);
  assert.match(validation, /ownerEmail/);
  assert.match(validation, /ownerPhone/);
  assert.match(service, /garageOwner\.update/);
});
