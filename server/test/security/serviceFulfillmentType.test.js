const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SERVICE_FULFILLMENT_MODE,
  SERVICE_FULFILLMENT_TYPE,
  allServicesSupportFulfillmentType,
  getRequiredServiceFulfillmentType,
  getServiceAllowedFulfillmentTypes,
  normalizeServiceFulfillmentMode,
  normalizeServiceFulfillmentType,
} = require("../../src/constants/serviceFulfillmentType");

test("unknown booking modes safely default to pickup and delivery", () => {
  assert.equal(
    normalizeServiceFulfillmentType(undefined),
    SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
  );
  assert.equal(
    normalizeServiceFulfillmentType("unexpected"),
    SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
  );
});

test("legacy pickup services normalize to customer choice mode", () => {
  assert.equal(
    normalizeServiceFulfillmentMode("PICKUP_DELIVERY"),
    SERVICE_FULFILLMENT_MODE.BOTH,
  );
  assert.deepEqual(
    getServiceAllowedFulfillmentTypes({ fulfillmentType: "BOTH" }),
    [
      SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
      SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF,
    ],
  );
});

test("self drop-off-only services force self drop-off for the booking", () => {
  const services = [
    { fulfillmentType: "BOTH" },
    { fulfillmentType: "SELF_DROP_OFF" },
  ];

  assert.equal(
    getRequiredServiceFulfillmentType(services),
    SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF,
  );
  assert.equal(
    allServicesSupportFulfillmentType(
      services,
      SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
    ),
    false,
  );
  assert.equal(
    allServicesSupportFulfillmentType(
      services,
      SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF,
    ),
    true,
  );
});

test("all standard services support either customer-selected mode", () => {
  const services = [
    { fulfillmentType: "BOTH" },
    { fulfillmentType: "BOTH" },
  ];

  assert.equal(getRequiredServiceFulfillmentType(services), null);
  assert.equal(
    allServicesSupportFulfillmentType(
      services,
      SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY,
    ),
    true,
  );
  assert.equal(
    allServicesSupportFulfillmentType(
      services,
      SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF,
    ),
    true,
  );
});
