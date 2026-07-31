const { body, param, query } = require("express-validator");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const phoneRule = body("phone")
  .trim()
  .matches(/^\+91[6-9]\d{9}$/)
  .withMessage("Enter a valid Indian phone number in +91 format");

const optionalGarageId = [
  query("garageId").optional().isUUID().withMessage("Invalid garage ID"),
  body("garageId").optional().isUUID().withMessage("Invalid garage ID"),
];
const controllerId = [
  param("controllerId").isUUID().withMessage("Invalid controller ID"),
  ...optionalGarageId,
];

const createFields = [
  body("name").trim().isLength({ min: 2, max: 120 }),
  phoneRule,
  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),
  body("password").matches(PASSWORD_REGEX).withMessage("Use at least 8 characters with uppercase, lowercase, number and symbol"),
];

const create = [...createFields];
const adminCreate = [
  param("garageId").isUUID().withMessage("A valid garage ID is required"),
  ...createFields,
];

const update = [
  ...controllerId,
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("email")
    .optional({ checkFalsy: true, nullable: true })
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),
  body("phone").optional().trim().matches(/^\+91[6-9]\d{9}$/),
  body("isActive").optional().isBoolean(),
  body("availability").optional().isIn(["AVAILABLE", "BUSY"]),
];

const password = [
  ...controllerId,
  body("password").matches(PASSWORD_REGEX),
];

const limit = [
  param("garageId").isUUID(),
  body("limit").isInt({ min: 0, max: 100 }),
];

const transfer = [
  param("bookingId").isUUID(),
  body("garageId").optional().isUUID(),
  body("controllerId").isUUID(),
];

const availability = [body("availability").isIn(["AVAILABLE", "BUSY"])];

module.exports = {
  adminCreate,
  availability,
  controllerId,
  create,
  limit,
  optionalGarageId,
  password,
  transfer,
  update,
};
