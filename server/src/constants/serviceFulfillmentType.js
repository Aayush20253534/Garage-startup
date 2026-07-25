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

const getBookingServices = (booking = {}) =>
  (Array.isArray(booking?.services) ? booking.services : [])
    .map((item) => item?.service || item)
    .filter(Boolean);

/**
 * Booking.fulfillmentType is a concrete customer choice. Older deployments
 * briefly allowed the service-level BOTH value to leak into booking rows.
 * Resolve that legacy value deterministically so matching and notifications
 * remain safe until the corrective migration rewrites the row.
 */
const resolveBookingFulfillmentType = (booking = {}) => {
  const storedValue = String(booking?.fulfillmentType || "")
    .trim()
    .toUpperCase();

  if (SERVICE_FULFILLMENT_TYPES.includes(storedValue)) {
    return storedValue;
  }

  return (
    getRequiredServiceFulfillmentType(getBookingServices(booking)) ||
    SERVICE_FULFILLMENT_TYPE.PICKUP_DELIVERY
  );
};

const bookingUsesSelfDropOff = (booking = {}) =>
  resolveBookingFulfillmentType(booking) ===
  SERVICE_FULFILLMENT_TYPE.SELF_DROP_OFF;

module.exports = {
  SERVICE_FULFILLMENT_MODE,
  SERVICE_FULFILLMENT_MODES,
  SERVICE_FULFILLMENT_TYPE,
  SERVICE_FULFILLMENT_TYPES,
  allServicesSupportFulfillmentType,
  bookingUsesSelfDropOff,
  getRequiredServiceFulfillmentType,
  getServiceAllowedFulfillmentTypes,
  normalizeServiceFulfillmentMode,
  normalizeServiceFulfillmentType,
  resolveBookingFulfillmentType,
  serviceSupportsFulfillmentType,
};
