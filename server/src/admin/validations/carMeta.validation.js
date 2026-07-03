const { body, param, query } = require("express-validator");

const brandIdSchema = [
  param("brandId").isUUID().withMessage("Invalid car brand ID"),
];

const modelIdSchema = [
  param("modelId").isUUID().withMessage("Invalid car model ID"),
];

const brandQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("includeInactive").optional({ nullable: true }).isBoolean(),
];

const createBrandSchema = [
  body("name").trim().notEmpty().withMessage("Car brand name is required"),
  body("models").optional({ nullable: true }),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const updateBrandSchema = [
  ...brandIdSchema,
  body("name").optional({ nullable: true }).trim().notEmpty(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const createModelSchema = [
  ...brandIdSchema,
  body("name").trim().notEmpty().withMessage("Car model name is required"),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const updateModelSchema = [
  ...modelIdSchema,
  body("name").optional({ nullable: true }).trim().notEmpty(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

module.exports = {
  brandIdSchema,
  brandQuerySchema,
  createBrandSchema,
  createModelSchema,
  modelIdSchema,
  updateBrandSchema,
  updateModelSchema,
};
