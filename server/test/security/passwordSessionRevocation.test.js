const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPasswordChangeSessionRevocation,
} = require("../../src/customer/security/passwordSessionRevocation");

test("customer password changes revoke every other active session", () => {
  assert.deepEqual(
    getPasswordChangeSessionRevocation({
      accountType: "USER",
      accountId: "user-1",
      currentSessionId: "current-session",
    }),
    {
      model: "userSession",
      where: {
        userId: "user-1",
        revokedAt: null,
        id: { not: "current-session" },
      },
    },
  );
});

test("staff password changes revoke all privileged sessions", () => {
  assert.deepEqual(
    getPasswordChangeSessionRevocation({
      accountType: "STAFF",
      accountId: "staff-1",
    }),
    {
      model: "staffSession",
      where: { staffAccountId: "staff-1", revokedAt: null },
    },
  );
});
