const { body, param, query } = require("express-validator");

const fuelTypes = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "OTHER"];

const priceRangeIdSchema = [param("id").isUUID().withMessage("Invalid price range ID")];

const priceRangeQuerySchema = [
  query("city").optional({ nullable: true, checkFalsy: true }).trim(),
  query("serviceId").optional({ nullable: true, checkFalsy: true }).isUUID(),
  query("vehicleBrand").optional({ nullable: true, checkFalsy: true }).trim(),
  query("vehicleModel").optional({ nullable: true, checkFalsy: true }).trim(),
  query("fuelType").optional({ nullable: true, checkFalsy: true }).isIn(fuelTypes),
  query("isActive").optional({ nullable: true, checkFalsy: true }).isBoolean(),
];

const createPriceRangeSchema = [
  body("city").trim().notEmpty().withMessage("City is required"),
  body("serviceId").isUUID().withMessage("Valid service ID is required"),
  body("vehicleBrand").trim().notEmpty().withMessage("Vehicle brand is required"),
  body("vehicleModel").optional({ nullable: true, checkFalsy: true }).trim(),
  body("fuelType").optional({ nullable: true, checkFalsy: true }).isIn(fuelTypes),
  body("minPrice").isInt({ min: 0 }).withMessage("minPrice must be positive"),
  body("maxPrice").isInt({ min: 0 }).withMessage("maxPrice must be positive"),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const updatePriceRangeSchema = [
  param("id").isUUID().withMessage("Invalid price range ID"),
  body("city").optional({ nullable: true, checkFalsy: true }).trim(),
  body("serviceId").optional({ nullable: true, checkFalsy: true }).isUUID(),
  body("vehicleBrand")
    .optional({ nullable: false })
    .trim()
    .notEmpty()
    .withMessage("Vehicle brand cannot be empty"),
  body("vehicleModel").optional({ nullable: true }).trim(),
  body("fuelType").optional({ nullable: true, checkFalsy: true }).isIn(fuelTypes),
  body("minPrice").optional({ nullable: true }).isInt({ min: 0 }),
  body("maxPrice").optional({ nullable: true }).isInt({ min: 0 }),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

module.exports = {
  createPriceRangeSchema,
  priceRangeIdSchema,
  priceRangeQuerySchema,
  updatePriceRangeSchema,
};
