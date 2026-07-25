const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SERVICE_FULFILLMENT_TYPE,
  getServiceFulfillmentTypes,
  hasMixedServiceFulfillmentTypes,
  normalizeServiceFulfillmentType,
} = require("../../src/constants/serviceFulfillmentType");

test("unknown and missing modes safely default to pickup and delivery", () => {
  assert.equal(
    normalizeServiceFulfillmentType(undefined),
    SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
  );
  assert.equal(
    normalizeServiceFulfillmentType("unexpected"),
    SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
  );
});

test("self drop-off mode is normalized case-insensitively", () => {
  assert.equal(
    normalizeServiceFulfillmentType(" self_drop_off "),
    SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF,
  );
});

test("same-mode service groups are compatible", () => {
  const services = [
    { fulfillmentType: "SELF_DROP_OFF" },
    { fulfillmentType: "SELF_DROP_OFF" },
  ];

  assert.deepEqual(getServiceFulfillmentTypes(services), ["SELF_DROP_OFF"]);
  assert.equal(hasMixedServiceFulfillmentTypes(services), false);
});

test("pickup and self drop-off services are detected as an invalid mixed group", () => {
  const services = [
    { fulfillmentType: "PICKUP_DELIVERY" },
    { fulfillmentType: "SELF_DROP_OFF" },
  ];

  assert.equal(hasMixedServiceFulfillmentTypes(services), true);
});
