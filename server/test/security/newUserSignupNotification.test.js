const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const read = (relative) =>
  fs.readFileSync(path.join(__dirname, "../..", relative), "utf8");

test("successful password and Google signups notify the Rovauto inbox", () => {
  const authService = read("src/customer/services/auth.service.js");
  const notificationService = read(
    "src/customer/services/newUserSignupNotification.service.js",
  );

  assert.match(
    notificationService,
    /DEFAULT_NOTIFICATION_RECIPIENT = "rovauto\.official@gmail\.com"/,
  );
  assert.match(notificationService, /process\.env\.RESEND_API_KEY/);
  assert.match(notificationService, /subject: "New Rovauto customer signup"/);
  assert.match(notificationService, /escapeHtml\(details\.name\)/);
  assert.match(notificationService, /escapeHtml\(details\.email\)/);

  assert.match(
    authService,
    /await notifyNewCustomerSignup\(user, "PASSWORD"\)/,
  );
  assert.match(
    authService,
    /if \(isNewUser\) \{\s*await notifyNewCustomerSignup\(user, "GOOGLE"\)/,
  );
});

test("signup remains successful when the internal notification cannot be sent", () => {
  const authService = read("src/customer/services/auth.service.js");
  const notifierStart = authService.indexOf("const notifyNewCustomerSignup");
  const signupStart = authService.indexOf("const signup", notifierStart);
  const notifier = authService.slice(notifierStart, signupStart);

  assert.match(notifier, /try \{/);
  assert.match(notifier, /catch \(error\)/);
  assert.match(notifier, /notification failed/);
  assert.doesNotMatch(notifier, /throw error/);
});

test("signup notification sends escaped customer details through Resend", async () => {
  const originalLoad = Module._load;
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;
  const originalResendFrom = process.env.RESEND_FROM_EMAIL;
  const originalRecipient = process.env.NEW_USER_NOTIFICATION_EMAIL;
  let sentPayload = null;

  class FakeResend {
    constructor(apiKey) {
      assert.equal(apiKey, "test-resend-key");
      this.emails = {
        send: async (payload) => {
          sentPayload = payload;
          return { data: { id: "email_123" }, error: null };
        },
      };
    }
  }

  try {
    Module._load = function load(request, parent, isMain) {
      if (request === "resend") return { Resend: FakeResend };
      return originalLoad.call(this, request, parent, isMain);
    };

    const servicePath = require.resolve(
      "../../src/customer/services/newUserSignupNotification.service",
    );
    delete require.cache[servicePath];
    const { sendNewUserSignupNotification } = require(servicePath);
    Module._load = originalLoad;

    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "Rovauto <noreply@rovauto.com>";
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.NEW_USER_NOTIFICATION_EMAIL;

    const result = await sendNewUserSignupNotification({
      user: {
        id: "customer_123",
        name: "Ayush <script>alert(1)</script>",
        email: "ayush@example.com",
        phone: "+919999999999",
        createdAt: "2026-08-02T12:00:00.000Z",
      },
      signupMethod: "PASSWORD",
    });

    assert.deepEqual(result, { sent: true, emailId: "email_123" });
    assert.deepEqual(sentPayload.to, ["rovauto.official@gmail.com"]);
    assert.equal(sentPayload.from, "Rovauto <noreply@rovauto.com>");
    assert.equal(sentPayload.subject, "New Rovauto customer signup");
    assert.match(sentPayload.text, /customer_123/);
    assert.match(sentPayload.text, /PASSWORD/);
    assert.match(sentPayload.html, /Ayush &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(sentPayload.html, /<script>/);
  } finally {
    Module._load = originalLoad;

    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;

    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;

    if (originalResendFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalResendFrom;

    if (originalRecipient === undefined) {
      delete process.env.NEW_USER_NOTIFICATION_EMAIL;
    } else {
      process.env.NEW_USER_NOTIFICATION_EMAIL = originalRecipient;
    }
  }
});
