const { body, param, query } = require("express-validator");

const categoryIdSchema = [
  param("categoryId").isUUID().withMessage("Invalid service category ID"),
];

const serviceIdSchema = [
  param("serviceId").isUUID().withMessage("Invalid service ID"),
];


const restrictedCityIdsSchema = [
  body("restrictedCityIds")
    .optional({ nullable: true })
    .isArray({ max: 100 })
    .withMessage("restrictedCityIds must be an array with at most 100 cities"),
  body("restrictedCityIds.*")
    .optional()
    .isUUID()
    .withMessage("Each restricted city ID must be valid"),
];

const categoryQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("includeInactive").optional({ nullable: true }).isBoolean(),
];

const createCategorySchema = [
  body("name").trim().notEmpty().withMessage("Service category name is required"),
  body("description").optional({ nullable: true }).trim(),
  body("isActive").optional({ nullable: true }).isBoolean().toBoolean(),
  body("isComingSoon")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("isComingSoon must be true or false")
    .toBoolean(),
  ...restrictedCityIdsSchema,
];

const updateCategorySchema = [
  ...categoryIdSchema,
  body("name").optional({ nullable: true }).trim().notEmpty(),
  body("description").optional({ nullable: true }).trim(),
  body("isActive").optional({ nullable: true }).isBoolean().toBoolean(),
  body("isComingSoon")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("isComingSoon must be true or false")
    .toBoolean(),
  ...restrictedCityIdsSchema,
];

const createServiceSchema = [
  body("categoryId").isUUID().withMessage("Valid category ID is required"),
  body("name").trim().notEmpty().withMessage("Service name is required"),
  body("description").optional({ nullable: true }).trim(),
  body("isActive").optional({ nullable: true }).isBoolean().toBoolean(),
  body("isComingSoon")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("isComingSoon must be true or false")
    .toBoolean(),
  ...restrictedCityIdsSchema,
];

const updateServiceSchema = [
  ...serviceIdSchema,
  body("categoryId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID(),
  body("name").optional({ nullable: true }).trim().notEmpty(),
  body("description").optional({ nullable: true }).trim(),
  body("isActive").optional({ nullable: true }).isBoolean().toBoolean(),
  body("isComingSoon")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("isComingSoon must be true or false")
    .toBoolean(),
  ...restrictedCityIdsSchema,
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
