const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const settings = fs.readFileSync(
  path.resolve(__dirname, "../../../client/src/pages/garage/Settings.jsx"),
  "utf8",
);

test("garage portal does not expose a self-service delete account option", () => {
  assert.doesNotMatch(settings, /Delete Account/);
  assert.doesNotMatch(settings, /showDeleteModal/);
  assert.doesNotMatch(settings, /handleDeleteAccount/);
  assert.doesNotMatch(settings, /requestDeleteAccountOtp/);
  assert.doesNotMatch(settings, /garageApi\.deleteAccount/);
  assert.match(settings, /title: "Logout"/);
  assert.match(settings, /title: "Change Password"/);
});
