export const SERVICE_FULFILLMENT_TYPE = Object.freeze({
  PICKUP_DELIVERY: "PICKUP_DELIVERY",
  SELF_DROP_OFF: "SELF_DROP_OFF",
});

export const MIXED_FULFILLMENT_MESSAGE =
  "Pickup-and-delivery services and self drop-off services cannot be added to the same booking. Remove the current service type or complete it in a separate booking.";

export const normalizeServiceFulfillmentType = (value) =>
  value === SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF
    ? SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF
    : SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY;

export const getServiceFulfillmentType = (service) =>
  normalizeServiceFulfillmentType(service?.fulfillmentType);

export const isSelfDropOffService = (service = {}) =>
  getServiceFulfillmentType(service) ===
  SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF;

export const getServiceFulfillmentLabel = (service = {}) =>
  isSelfDropOffService(service)
    ? "Self drop-off & pickup"
    : "Pickup & delivery";

export const hasMixedFulfillmentTypes = (services = []) =>
  new Set(services.map(getServiceFulfillmentType)).size > 1;
