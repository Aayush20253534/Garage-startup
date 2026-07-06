const { body, param, query } = require("express-validator");

const INDIA_LATITUDE_RANGE = { min: 6, max: 38 };
const INDIA_LONGITUDE_RANGE = { min: 68, max: 98 };

const rejectZeroBodyCoordinates = (_, { req }) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude === 0 &&
    longitude === 0
  ) {
    throw new Error(
      "Invalid location coordinates. Please choose your location again.",
    );
  }

  return true;
};

const rejectZeroQueryCoordinates = (_, { req }) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude === 0 &&
    longitude === 0
  ) {
    throw new Error(
      "Invalid location coordinates. Please choose your location again.",
    );
  }

  return true;
};

const geocodeLocationValidation = [
  query("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Address must be at most 300 characters"),

  query("area")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Area must be at most 120 characters"),

  query("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("City must be at most 120 characters"),

  query("state")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("State must be at most 120 characters"),

  query("pincode")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\d{5,6}$/)
    .withMessage("Pincode must contain 5 or 6 digits"),

  query("country")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Country must be at most 120 characters"),
];

const reverseGeocodeLocationValidation = [
  query("latitude")
    .notEmpty()
    .withMessage("Latitude is required")
    .bail()
    .isFloat(INDIA_LATITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now"),

  query("longitude")
    .notEmpty()
    .withMessage("Longitude is required")
    .bail()
    .isFloat(INDIA_LONGITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now")
    .custom(rejectZeroQueryCoordinates),
];

const locationIdValidation = [
  param("id").isUUID().withMessage("Invalid location ID"),
];

const createLocationValidation = [
  body("latitude")
    .notEmpty()
    .withMessage("Latitude is required")
    .bail()
    .isFloat(INDIA_LATITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now"),

  body("longitude")
    .notEmpty()
    .withMessage("Longitude is required")
    .bail()
    .isFloat(INDIA_LONGITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now")
    .custom(rejectZeroBodyCoordinates),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must be at most 500 characters"),

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

  body("latitude")
    .optional()
    .isFloat(INDIA_LATITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now"),

  body("longitude")
    .optional()
    .isFloat(INDIA_LONGITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now")
    .custom(rejectZeroBodyCoordinates),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Address must be at most 500 characters"),

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
