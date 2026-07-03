const { body, param, query } = require("express-validator");

const cityQuerySchema = [
  query("includeInactive").optional({ nullable: true }).isBoolean(),
];

const createCitySchema = [
  body("name").trim().notEmpty().withMessage("City name is required").isLength({ max: 120 }),
  body("state").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
];

const updateCitySchema = [
  param("cityId").isUUID().withMessage("Invalid city ID"),
  body("name").optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 1, max: 120 }),
  body("state").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  body("isActive").optional().isBoolean(),
];

module.exports = {
  cityQuerySchema,
  createCitySchema,
  updateCitySchema,
};
