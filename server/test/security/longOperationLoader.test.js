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
  const garageApplication = read(
    "client/src/pages/garage/onboarding/Step4.jsx",
  );
  const garageProfile = read("client/src/pages/garage/Profile.jsx");
  const garageWallet = read("client/src/pages/garage/Wallet.jsx");

  assert.match(loader, /title = "Your drive is ready"/);
  assert.match(loader, /message = "Signing you in/);
  assert.match(garageApplication, /title="Submitting your garage"/);
  assert.match(garageProfile, /title="Uploading garage photos"/);
  assert.match(garageWallet, /VERIFYING_RECHARGE/);
  assert.match(garageWallet, /setPaymentProgress\(null\);[\s\S]*cashfree\.checkout/);
});
