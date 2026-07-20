const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("the car loader is limited to genuinely long submit, upload, and payment operations", () => {
  const loader = read(
    "client/src/components/auth/CustomerLoginLoader.jsx",
  );
  const loaderStyles = read(
    "client/src/components/auth/CustomerLoginLoader.css",
  );
  const garageApplication = read(
    "client/src/pages/garage/onboarding/Step4.jsx",
  );
  const garageProfile = read("client/src/pages/garage/Profile.jsx");
  const garageWallet = read("client/src/pages/garage/Wallet.jsx");

  assert.match(loader, /title = "Your drive is ready"/);
  assert.match(loader, /message = "Signing you in/);
  assert.match(
    loaderStyles,
    /^\.customer-login-loader\s*\{[\s\S]*?display:\s*grid;/,
  );
  assert.doesNotMatch(
    loaderStyles,
    /\.customer-login-loader\s*\{\s*display:\s*none;/,
  );
  assert.match(loaderStyles, /@media \(min-width: 640px\)/);
  assert.match(garageApplication, /title="Submitting your garage"/);
  assert.match(garageProfile, /title="Uploading garage photos"/);
  assert.match(garageWallet, /VERIFYING_RECHARGE/);
  assert.match(garageWallet, /setPaymentProgress\(null\);[\s\S]*cashfree\.checkout/);
});

test("authentication submissions use portal-specific car loader messages", () => {
  const customerLogin = read("client/src/pages/auth/Login.jsx");
  const customerSignup = read("client/src/pages/auth/Register.jsx");
  const customerOtp = read("client/src/pages/auth/OTP.jsx");
  const garageLogin = read("client/src/pages/garage/auth/Login.jsx");
  const garageFirstLogin = read(
    "client/src/pages/garage/auth/FirstLoginPassword.jsx",
  );
  const staffLogin = read(
    "client/src/components/auth/StaffEmailOtpLoginForm.jsx",
  );

  assert.match(customerLogin, /title="Signing you in"/);
  assert.match(customerSignup, /visible=\{loading\}/);
  assert.match(customerSignup, /Creating your Rovauto account/);
  assert.match(customerOtp, /visible=\{loading \|\| resending\}/);
  assert.match(garageLogin, /title=\{[\s\S]*Signing in to your garage/);
  assert.match(garageFirstLogin, /Securing your garage account/);
  assert.match(staffLogin, /visible=\{loading \|\| resending\}/);
  assert.match(staffLogin, /Verifying secure access/);
});
