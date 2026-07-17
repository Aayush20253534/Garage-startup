const { body, param, query } = require("express-validator");

const serviceIdParamSchema = [
  param("id").isUUID().withMessage("Invalid service ID"),
];

const servicePricingQuerySchema = [
  query("city")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage("Invalid city"),
  query("vehicleId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Invalid vehicle ID"),
  query("vehicleBrandId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Invalid vehicle brand ID"),
  query("vehicleModelId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Invalid vehicle model ID")
    .custom((value, { req }) => {
      if (value && !req.query.vehicleBrandId) {
        throw new Error("Select a vehicle brand before selecting a model");
      }

      return true;
    }),
];

const createServiceSchema = [
  body("categoryId").isUUID().withMessage("Invalid category ID"),

  body("name")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Service name is required"),

  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  body("durationMin")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive integer"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

const updateServiceSchema = [
  param("id").isUUID().withMessage("Invalid service ID"),

  body("categoryId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Invalid category ID"),

  body("name")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage("Service name is required"),

  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  body("durationMin")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive integer"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

const createServiceCategorySchema = [
  body("name")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Category name is required"),

  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

module.exports = {
  serviceIdParamSchema,
  servicePricingQuerySchema,
  createServiceSchema,
  updateServiceSchema,
  createServiceCategorySchema,
};
