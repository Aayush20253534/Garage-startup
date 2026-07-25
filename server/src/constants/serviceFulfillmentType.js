const SERVICE_FULFILLMENT_TYPE = Object.freeze({
  PICKUP_DELIVERY: "PICKUP_DELIVERY",
  SELF_DROP_OFF: "SELF_DROP_OFF",
});

const SERVICE_FULFILLMENT_TYPES = Object.freeze(
  Object.values(SERVICE_FULFILLMENT_TYPE),
);

const SERVICE_FULFILLMENT_MODE = Object.freeze({
  BOTH: "BOTH",
  SELF_DROP_OFF: "SELF_DROP_OFF",
});

const SERVICE_FULFILLMENT_MODES = Object.freeze(
  Object.values(SERVICE_FULFILLMENT_MODE),
);

const normalizeServiceFulfillmentType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  return SERVICE_FULFILLMENT_TYPES.includes(normalized)
    ? normalized
    : SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY;
};

const normalizeServiceFulfillmentMode = (value) =>
  String(value || "").trim().toUpperCase() ===
  SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF
    ? SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF
    : SERVICE_FULFILLMENT_MODE.BOTH;

const getServiceAllowedFulfillmentTypes = (service = {}) =>
  normalizeServiceFulfillmentMode(service.fulfillmentType) ===
  SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF
    ? [SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF]
    : SERVICE_FULFILLMENT_TYPES;

const serviceSupportsFulfillmentType = (service = {}, fulfillmentType) =>
  getServiceAllowedFulfillmentTypes(service).includes(
    normalizeServiceFulfillmentType(fulfillmentType),
  );

const getRequiredServiceFulfillmentType = (services = []) =>
  services.some(
    (service) =>
      normalizeServiceFulfillmentMode(service?.fulfillmentType) ===
      SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF,
  )
    ? SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF
    : null;

const allServicesSupportFulfillmentType = (services = [], fulfillmentType) =>
  services.every((service) =>
    serviceSupportsFulfillmentType(service, fulfillmentType),
  );

module.exports = {
  SERVICE_FULFILLMENT_MODE,
  SERVICE_FULFILLMENT_MODES,
  SERVICE_FULFILLMENT_TYPE,
  SERVICE_FULFILLMENT_TYPES,
  allServicesSupportFulfillmentType,
  getRequiredServiceFulfillmentType,
  getServiceAllowedFulfillmentTypes,
  normalizeServiceFulfillmentMode,
  normalizeServiceFulfillmentType,
  serviceSupportsFulfillmentType,
};
