const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/rovauto_test";

const { deriveSystemIssueActor } = require("../../src/services/security/systemIssueActorRules");

test("unauthenticated frontend reports cannot claim ADMIN or SYSTEM", async () => {
  const adminSpoof = deriveSystemIssueActor({ account: null, payloadActorType: "ADMIN", hasRequest: true });
  const systemSpoof = deriveSystemIssueActor({ account: null, payloadActorType: "SYSTEM", hasRequest: true });

  assert.equal(adminSpoof.actorType, "PUBLIC");
  assert.equal(systemSpoof.actorType, "PUBLIC");
  assert.equal(adminSpoof.userId, null);
});

test("authenticated staff actor type is derived from the session", async () => {
  const actor = deriveSystemIssueActor({
    account: { id: "staff-1", accountType: "STAFF", role: "ADMIN" },
    payloadActorType: "PUBLIC",
    hasRequest: true,
  });

  assert.deepEqual(actor, {
    actorType: "ADMIN",
    userId: "staff-1",
    garageId: null,
    needsGarageLookup: false,
  });
});

test("internal background reports may still identify as SYSTEM", async () => {
  const actor = deriveSystemIssueActor({ account: null, payloadActorType: "SYSTEM", hasRequest: false });
  assert.equal(actor.actorType, "SYSTEM");
});
