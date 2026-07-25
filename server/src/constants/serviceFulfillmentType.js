const SERVICE_FULFILLMENT_TYPE = Object.freeze({
  PICKUP_DELIVERY: "PICKUP_DELIVERY",
  SELF_DROP_OFF: "SELF_DROP_OFF",
});

const SERVICE_FULFILLMENT_TYPES = Object.freeze(
  Object.values(SERVICE_FULFILLMENT_TYPE),
);

const normalizeServiceFulfillmentType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  return SERVICE_FULFILLMENT_TYPES.includes(normalized)
    ? normalized
    : SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY;
};

const getServiceFulfillmentTypes = (services = []) => [
  ...new Set(
    services.map((service) =>
      normalizeServiceFulfillmentType(service?.fulfillmentType),
    ),
  ),
];

const hasMixedServiceFulfillmentTypes = (services = []) =>
  getServiceFulfillmentTypes(services).length > 1;

module.exports = {
  SERVICE_FULFILLMENT_TYPE,
  SERVICE_FULFILLMENT_TYPES,
  getServiceFulfillmentTypes,
  hasMixedServiceFulfillmentTypes,
  normalizeServiceFulfillmentType,
};
