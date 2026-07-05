const { body, param, query } = require("express-validator");

const categoryIdSchema = [
  param("categoryId").isUUID().withMessage("Invalid service category ID"),
];

const serviceIdSchema = [
  param("serviceId").isUUID().withMessage("Invalid service ID"),
];

const categoryQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("includeInactive").optional({ nullable: true }).isBoolean(),
];

const createCategorySchema = [
  body("name").trim().notEmpty().withMessage("Service category name is required"),
  body("description").optional({ nullable: true }).trim(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const updateCategorySchema = [
  ...categoryIdSchema,
  body("name").optional({ nullable: true }).trim().notEmpty(),
  body("description").optional({ nullable: true }).trim(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const createServiceSchema = [
  body("categoryId").isUUID().withMessage("Valid category ID is required"),
  body("name").trim().notEmpty().withMessage("Service name is required"),
  body("description").optional({ nullable: true }).trim(),
  body("basePrice")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 }),
  body("minPrice").isInt({ min: 0 }).withMessage("minPrice must be positive"),
  body("maxPrice").isInt({ min: 0 }).withMessage("maxPrice must be positive"),
  body("isActive").optional({ nullable: true }).isBoolean(),
  body("isComingSoon")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("isComingSoon must be true or false"),
];

const updateServiceSchema = [
  ...serviceIdSchema,
  body("categoryId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID(),
  body("name").optional({ nullable: true }).trim().notEmpty(),
  body("description").optional({ nullable: true }).trim(),
  body("basePrice")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 }),
  body("minPrice").optional({ nullable: true }).isInt({ min: 0 }),
  body("maxPrice").optional({ nullable: true }).isInt({ min: 0 }),
  body("isActive").optional({ nullable: true }).isBoolean(),
  body("isComingSoon")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("isComingSoon must be true or false"),
];

module.exports = {
  categoryIdSchema,
  categoryQuerySchema,
  createCategorySchema,
  createServiceSchema,
  serviceIdSchema,
  updateCategorySchema,
  updateServiceSchema,
};
