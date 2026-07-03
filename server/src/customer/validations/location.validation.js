const { body, param, query } = require("express-validator");

const INDIA_LATITUDE_RANGE = { min: 6, max: 38 };
const INDIA_LONGITUDE_RANGE = { min: 68, max: 98 };

const rejectZeroCoordinates = (_, { req }) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude === 0 && longitude === 0) {
    throw new Error("Invalid location coordinates. Please choose your location again.");
  }

  return true;
};

const geocodeLocationValidation = [
  query("address").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 300 }),
  query("area").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("city").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("state").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("pincode").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 20 }),
  query("country").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("countrycodes").optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 8 }),
];
const locationIdValidation = [
  param("id").isUUID().withMessage("Invalid location ID"),
];

const createLocationValidation = [
  body("latitude")
    .notEmpty()
    .withMessage("Latitude is required")
    .isFloat(INDIA_LATITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now"),

  body("longitude")
    .notEmpty()
    .withMessage("Longitude is required")
    .isFloat(INDIA_LONGITUDE_RANGE)
    .withMessage("Rovauto is available only in India right now")
    .custom(rejectZeroCoordinates),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

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
    .custom(rejectZeroCoordinates),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

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
};
