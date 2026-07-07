const { body, param, query } = require("express-validator");

const SERVICE_AREA_BOUNDS = [
  { minLatitude: 26, maxLatitude: 31, minLongitude: 80, maxLongitude: 89 },
  { minLatitude: 6, maxLatitude: 38, minLongitude: 68, maxLongitude: 98 },
];

const SERVICE_AREA_COORDINATE_BOUNDS = {
  minLatitude: 6,
  maxLatitude: 38,
  minLongitude: 68,
  maxLongitude: 98,
};

const hasBodyField = (bodyValue, key) =>
  Object.prototype.hasOwnProperty.call(bodyValue || {}, key);

const isWithinServiceArea = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  !(latitude === 0 && longitude === 0) &&
  SERVICE_AREA_BOUNDS.some(
    (bounds) =>
      latitude >= bounds.minLatitude &&
      latitude <= bounds.maxLatitude &&
      longitude >= bounds.minLongitude &&
      longitude <= bounds.maxLongitude,
  );

const validateServiceAreaCoordinatePair = (
  bodyValue = {},
  { required = false } = {},
) => {
  const hasLatitude = hasBodyField(bodyValue, "latitude");
  const hasLongitude = hasBodyField(bodyValue, "longitude");

  if (!hasLatitude && !hasLongitude && !required) {
    return true;
  }

  if (!hasLatitude || !hasLongitude) {
    throw new Error("Latitude and longitude must be provided together.");
  }

  const latitude = Number(bodyValue.latitude);
  const longitude = Number(bodyValue.longitude);

  const valid = isWithinServiceArea(latitude, longitude);

  if (!valid) {
    throw new Error(
      "Invalid location coordinates. Please choose a location within the service area.",
    );
  }

  return true;
};

const geocodeLocationValidation = [
  query("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 }),
  query("area")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),
  query("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),
  query("state")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),
  query("pincode")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 }),
  query("country")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),
];

const reverseGeocodeLocationValidation = [
  query("latitude")
    .notEmpty()
    .withMessage("Latitude is required")
    .bail()
    .isFloat({
      min: SERVICE_AREA_COORDINATE_BOUNDS.minLatitude,
      max: SERVICE_AREA_COORDINATE_BOUNDS.maxLatitude,
    })
    .withMessage("Invalid latitude for a service-area location"),
  query("longitude")
    .notEmpty()
    .withMessage("Longitude is required")
    .bail()
    .isFloat({
      min: SERVICE_AREA_COORDINATE_BOUNDS.minLongitude,
      max: SERVICE_AREA_COORDINATE_BOUNDS.maxLongitude,
    })
    .withMessage("Invalid longitude for a service-area location"),
];

const locationIdValidation = [
  param("id").isUUID().withMessage("Invalid location ID"),
];

const createLocationValidation = [
  body().custom((bodyValue) =>
    validateServiceAreaCoordinatePair(bodyValue, { required: true }),
  ),
  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address is too long"),
  body("formattedAddress")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),
  body("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),
  body("placeId")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 }),
  body("addressComponents")
    .optional({ nullable: true })
    .isArray({ max: 30 }),
  body("source")
    .optional()
    .isIn(["GPS", "MANUAL"])
    .withMessage("Invalid location source"),
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false"),
];

const updateLocationValidation = [
  param("id").isUUID().withMessage("Invalid location ID"),
  body().custom((bodyValue) =>
    validateServiceAreaCoordinatePair(bodyValue, { required: false }),
  ),
  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address is too long"),
  body("formattedAddress")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }),
  body("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),
  body("placeId")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 }),
  body("addressComponents")
    .optional({ nullable: true })
    .isArray({ max: 30 }),
  body("source")
    .optional()
    .isIn(["GPS", "MANUAL"])
    .withMessage("Invalid location source"),
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false"),
];

module.exports = {
  locationIdValidation,
  createLocationValidation,
  updateLocationValidation,
  geocodeLocationValidation,
  reverseGeocodeLocationValidation,
};
