const { body, param } = require("express-validator");

const serviceIdParamSchema = [
  param("id").isUUID().withMessage("Invalid service ID"),
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
  createServiceSchema,
  updateServiceSchema,
  createServiceCategorySchema,
};
