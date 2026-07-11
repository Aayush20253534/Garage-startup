const test = require("node:test");
const assert = require("node:assert/strict");

const { authorizeRoles } = require("../../src/middlewares/role.middleware");

const run = (middleware, user) => {
  let error = null;
  let passed = false;
  middleware({ user }, {}, (value) => {
    error = value || null;
    passed = !value;
  });
  return { error, passed };
};

test("role authorization rejects anonymous and wrong-role sessions", () => {
  const middleware = authorizeRoles("ADMIN");
  assert.equal(run(middleware, null).error.statusCode, 401);
  assert.equal(run(middleware, { role: "CUSTOMER" }).error.statusCode, 403);
});

test("role authorization permits the expected role", () => {
  const result = run(authorizeRoles("ADMIN", "INTERN"), { role: "INTERN" });
  assert.equal(result.passed, true);
});

test("garage owners must change a temporary password first", () => {
  const result = run(authorizeRoles("GARAGE_OWNER"), {
    role: "GARAGE_OWNER",
    passwordChangedAt: null,
  });
  assert.equal(result.error.statusCode, 403);
  assert.equal(result.error.code, "GARAGE_PASSWORD_CHANGE_REQUIRED");
});
