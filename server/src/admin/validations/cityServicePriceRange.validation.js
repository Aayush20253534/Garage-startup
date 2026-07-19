const { body, param, query } = require("express-validator");

const fuelTypes = ["PETROL", "DIESEL", "HYBRID", "CNG", "OTHER"];

const priceRangeIdSchema = [param("id").isUUID().withMessage("Invalid price range ID")];

const deletePriceRangesSchema = [
  body("priceRangeIds")
    .optional()
    .isArray({ min: 1, max: 1000 })
    .withMessage("Select between 1 and 1000 price ranges"),
  body("priceRangeIds.*")
    .optional()
    .isUUID()
    .withMessage("Invalid price range ID"),
  body("deleteAll").optional().isBoolean(),
  body().custom((payload = {}) => {
    if (payload.deleteAll === true) return true;
    if (Array.isArray(payload.priceRangeIds) && payload.priceRangeIds.length > 0) {
      return true;
    }
    throw new Error("Select price ranges or request deletion of all price ranges");
  }),
];

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
  deletePriceRangesSchema,
  priceRangeIdSchema,
  priceRangeQuerySchema,
  updatePriceRangeSchema,
};
