export const SERVICE_FULFILLMENT_TYPE = Object.freeze({
  PICKUP_DELIVERY: "PICKUP_DELIVERY",
  SELF_DROP_OFF: "SELF_DROP_OFF",
});

export const SERVICE_FULFILLMENT_MODE = Object.freeze({
  BOTH: "BOTH",
  SELF_DROP_OFF: "SELF_DROP_OFF",
});

export const normalizeServiceFulfillmentType = (value) =>
  value === SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF
    ? SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF
    : SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY;

export const normalizeServiceFulfillmentMode = (value) =>
  value === SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF
    ? SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF
    : SERVICE_FULFILLMENT_MODE.BOTH;

export const getServiceFulfillmentType = (record = {}) =>
  normalizeServiceFulfillmentType(record?.fulfillmentType);

export const getServiceFulfillmentMode = (service = {}) =>
  normalizeServiceFulfillmentMode(service?.fulfillmentType);

export const isSelfDropOffService = (record = {}) =>
  record?.fulfillmentType === SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF;

export const isSelfDropOffOnlyService = (service = {}) =>
  getServiceFulfillmentMode(service) ===
  SERVICE_FULFILLMENT_MODE.SELF_DROP_OFF;

export const getServiceFulfillmentLabel = (service = {}) =>
  isSelfDropOffOnlyService(service)
    ? "Self drop-off only"
    : "Pickup or self drop-off";

export const cartRequiresSelfDropOff = (services = []) =>
  services.some(isSelfDropOffOnlyService);

export const serviceSupportsFulfillmentType = (service = {}, type) =>
  isSelfDropOffOnlyService(service)
    ? type === SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF
    : Object.values(SERVICE_FULFILLMENT_TYPE).includes(type);
