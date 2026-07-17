const { query } = require("express-validator");

const nearbyGarageQueryValidation = [
  query("latitude")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid search latitude")
    .custom((value, { req }) => {
      if (value !== undefined && !String(req.query.longitude || "").trim()) {
        throw new Error("Latitude and longitude must be provided together");
      }

      return true;
    }),
  query("longitude")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid search longitude")
    .custom((value, { req }) => {
      if (value !== undefined && !String(req.query.latitude || "").trim()) {
        throw new Error("Latitude and longitude must be provided together");
      }

      return true;
    }),
  query("maxDistance")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 1, max: 100 })
    .withMessage("Search distance must be between 1 and 100 km"),
];

module.exports = { nearbyGarageQueryValidation };
