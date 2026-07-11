const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/rovauto_test";

const {
  resolveDeliveryEmail,
  STAFF_OTP_MAX_ATTEMPTS,
} = require("../../src/customer/security/staffTwoFactorRules");

test("admin OTP always uses the environment-controlled mailbox", () => {
  process.env.ADMIN_2FA_EMAIL = "security@rovauto.com";
  assert.equal(
    resolveDeliveryEmail({ role: "ADMIN", email: "ignored@example.com" }),
    "security@rovauto.com",
  );
});

test("intern and support OTP use their stored account email", () => {
  assert.equal(
    resolveDeliveryEmail({ role: "INTERN", email: " Intern@Rovauto.com " }),
    "intern@rovauto.com",
  );
  assert.equal(
    resolveDeliveryEmail({ role: "CUSTOMER_SUPPORT", email: "support@rovauto.com" }),
    "support@rovauto.com",
  );
});

test("staff OTP verification limits remain enforced", () => {
  assert.equal(STAFF_OTP_MAX_ATTEMPTS, 5);
});
