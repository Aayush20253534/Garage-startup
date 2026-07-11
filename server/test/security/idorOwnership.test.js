const test = require("node:test");
const assert = require("node:assert/strict");

const { buildOwnedResourceWhere } = require("../../src/customer/security/ownership");

test("owned-resource queries always bind both resource and authenticated user", () => {
  assert.deepEqual(
    buildOwnedResourceWhere({ id: "booking-1", userId: "user-1" }),
    { id: "booking-1", userId: "user-1" },
  );
});

test("owned-resource queries cannot be built without an authenticated owner", () => {
  assert.throws(
    () => buildOwnedResourceWhere({ id: "booking-1", userId: "" }),
    (error) => error.statusCode === 400,
  );
});
