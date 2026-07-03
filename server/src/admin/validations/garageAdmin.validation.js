const { body, param, query } = require("express-validator");

const garageIdSchema = [
  param("garageId").isUUID().withMessage("Invalid garage ID"),
];

const deleteGaragesSchema = [
  body("garageIds").isArray({ min: 1 }).withMessage("Select at least one garage to delete"),
  body("garageIds.*").isUUID().withMessage("Invalid garage ID"),
];

const serviceIdSchema = [
  ...garageIdSchema,
  param("serviceId").isUUID().withMessage("Invalid service ID"),
];

const garageQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("isActive").optional({ nullable: true, checkFalsy: true }).isBoolean(),
  query("isVerified").optional({ nullable: true, checkFalsy: true }).isBoolean(),
];

const assignableServiceQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("categoryId").optional({ nullable: true, checkFalsy: true }).isUUID(),
];

const upsertGarageServiceSchema = [
  ...garageIdSchema,
  body("serviceId").isUUID().withMessage("Valid service ID is required"),
  body("price").optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage("Price must be positive"),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

module.exports = {
  assignableServiceQuerySchema,
  deleteGaragesSchema,
  garageIdSchema,
  garageQuerySchema,
  serviceIdSchema,
  upsertGarageServiceSchema,
};
