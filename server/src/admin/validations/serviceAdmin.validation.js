const { body, param, query } = require("express-validator");
const { SERVICE_FULFILLMENT_MODES } = require("../../constants/serviceFulfillmentType");

const SERVICE_FULFILLMENT_INPUTS = [
  ...SERVICE_FULFILLMENT_MODES,
  "PICKUP_DELIVERY", // Legacy admin clients normalize to BOTH in the service layer.
];

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
  body("fulfillmentType")
    .optional({ nullable: true })
    .isIn(SERVICE_FULFILLMENT_INPUTS)
    .withMessage("fulfillmentType must be BOTH or SELF_DROP_OFF"),
  ...restrictedCityIdsSchema,
];

const reorderCategoryServicesSchema = [
  ...categoryIdSchema,
  body("serviceIds")
    .isArray({ min: 1, max: 500 })
    .withMessage("serviceIds must contain the complete ordered service list"),
  body("serviceIds.*")
    .isUUID()
    .withMessage("Each service ID must be valid"),
];

const updatePopularServicesSchema = [
  body("serviceIds")
    .isArray({ max: 6 })
    .withMessage("serviceIds must be an array with at most 6 services"),
  body("serviceIds.*")
    .isUUID()
    .withMessage("Each popular service ID must be valid"),
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
  body("fulfillmentType")
    .optional({ nullable: true })
    .isIn(SERVICE_FULFILLMENT_INPUTS)
    .withMessage("fulfillmentType must be BOTH or SELF_DROP_OFF"),
  ...restrictedCityIdsSchema,
];

module.exports = {
  categoryIdSchema,
  categoryQuerySchema,
  createCategorySchema,
  createServiceSchema,
  reorderCategoryServicesSchema,
  serviceIdSchema,
  updateCategorySchema,
  updatePopularServicesSchema,
  updateServiceSchema,
};
