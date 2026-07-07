const { body, param, query } = require("express-validator");

const INDIA_LAT = { min: 6, max: 38 };
const INDIA_LNG = { min: 68, max: 98 };

const coordinateObject = (field, required = true) => {
  const chain = body(field);
  if (!required) chain.optional({ nullable: true });
  return chain
    .isObject()
    .withMessage(`${field} must be a coordinate object`)
    .bail()
    .custom((value) => {
      const latitude = Number(value?.latitude ?? value?.lat);
      const longitude = Number(value?.longitude ?? value?.lng);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < INDIA_LAT.min ||
        latitude > INDIA_LAT.max ||
        longitude < INDIA_LNG.min ||
        longitude > INDIA_LNG.max
      ) {
        throw new Error(`${field} must contain valid Indian coordinates`);
      }
      return true;
    });
};

const addressValidation = [
  body("addressLines")
    .custom((value) => {
      const lines = Array.isArray(value) ? value : [value];
      if (!lines.some((line) => String(line || "").trim())) {
        throw new Error("At least one address line is required");
      }
      if (lines.length > 3 || lines.some((line) => String(line || "").length > 300)) {
        throw new Error("Address lines are too long");
      }
      return true;
    }),
  body("locality").optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body("administrativeArea").optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body("postalCode").optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
];

const autocompleteValidation = [
  body("input").trim().isLength({ min: 3, max: 160 }),
  body("sessionToken").optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body("latitude").optional({ nullable: true }).isFloat(INDIA_LAT),
  body("longitude").optional({ nullable: true }).isFloat(INDIA_LNG),
];

const placeDetailsValidation = [
  param("placeId").trim().notEmpty().isLength({ max: 300 }),
  query("sessionToken").optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
];

const routeValidation = [
  coordinateObject("origin"),
  coordinateObject("destination"),
  body("trafficAware").optional().isBoolean(),
  body("alternatives").optional().isBoolean(),
];

const routeMatrixValidation = [
  body("origins").isArray({ min: 1, max: 10 }),
  body("destinations").isArray({ min: 1, max: 25 }),
  body().custom((value) => {
    if ((value.origins?.length || 0) * (value.destinations?.length || 0) > 100) {
      throw new Error("Route matrix cannot exceed 100 elements");
    }
    [...(value.origins || []), ...(value.destinations || [])].forEach((item) => {
      const latitude = Number(item?.latitude ?? item?.lat);
      const longitude = Number(item?.longitude ?? item?.lng);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < INDIA_LAT.min ||
        latitude > INDIA_LAT.max ||
        longitude < INDIA_LNG.min ||
        longitude > INDIA_LNG.max
      ) {
        throw new Error("Every route matrix point must be within India");
      }
    });
    return true;
  }),
  body("trafficAware").optional().isBoolean(),
];

const roadsValidation = [
  body("points").isArray({ min: 2, max: 100 }),
  body("interpolate").optional().isBoolean(),
  body("points.*.latitude").isFloat(INDIA_LAT),
  body("points.*.longitude").isFloat(INDIA_LNG),
];

const bookingIdValidation = [
  param("bookingId").isUUID().withMessage("Invalid booking ID"),
];

const trackingPointValidation = [
  ...bookingIdValidation,
  body("latitude").isFloat(INDIA_LAT),
  body("longitude").isFloat(INDIA_LNG),
  body("heading").optional({ nullable: true }).isFloat({ min: 0, max: 360 }),
  body("speedKph").optional({ nullable: true }).isFloat({ min: 0, max: 300 }),
  body("accuracyM").optional({ nullable: true }).isFloat({ min: 0, max: 10000 }),
  body("recordedAt").optional({ nullable: true }).isISO8601(),
];

const optimizationValidation = [
  body("bookingIds").optional().isArray({ max: 100 }),
  body("bookingIds.*").optional().isUUID(),
];

module.exports = {
  addressValidation,
  autocompleteValidation,
  bookingIdValidation,
  optimizationValidation,
  placeDetailsValidation,
  roadsValidation,
  routeMatrixValidation,
  routeValidation,
  trackingPointValidation,
};
