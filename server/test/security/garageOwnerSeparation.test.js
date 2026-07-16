const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { normalizeEmail } = require("../../src/utils/email");

const projectRoot = path.resolve(__dirname, "../..");
const schema = fs.readFileSync(
  path.join(projectRoot, "prisma/schema.prisma"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(
    projectRoot,
    "prisma/migrations/20260716090000_separate_garage_owner_accounts/migration.sql",
  ),
  "utf8",
);
const authService = fs.readFileSync(
  path.join(projectRoot, "src/customer/services/auth.service.js"),
  "utf8",
);

test("Gmail dot and alias variants resolve to one Rovauto identity", () => {
  assert.equal(normalizeEmail("abc@gmail.com"), "abc@gmail.com");
  assert.equal(normalizeEmail("a.bc@gmail.com"), "abc@gmail.com");
  assert.equal(normalizeEmail("A.BC+garage@googlemail.com"), "abc@gmail.com");
  assert.equal(normalizeEmail("a.bc@outlook.com"), "a.bc@outlook.com");
});

test("garage owners and their authentication data use dedicated models", () => {
  assert.match(schema, /model GarageOwner\s*\{/);
  assert.match(schema, /model GarageOwnerSession\s*\{/);
  assert.match(schema, /model GarageOwnerOtp\s*\{/);
  assert.match(schema, /owner\s+GarageOwner\?/);
  assert.doesNotMatch(schema, /ownedGarages\s+Garage\[\]/);
  assert.match(authService, /prisma\.garageOwner\.findFirst/);
  assert.match(authService, /createGarageOwnerSession/);
});

test("garage-owner migration preserves IDs and rejects Gmail collisions", () => {
  assert.match(migration, /INSERT INTO "garage_owners"/);
  assert.match(migration, /SELECT\s+"id"/);
  assert.match(migration, /duplicate Gmail identities exist/);
  assert.match(migration, /DELETE FROM "User" WHERE "role" = 'GARAGE_OWNER'/);
  assert.match(migration, /User_customer_role_check/);
});
