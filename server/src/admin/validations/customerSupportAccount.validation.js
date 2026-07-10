const { body, param } = require("express-validator");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";

const accountId = [
  param("accountId").isUUID().withMessage("Invalid customer support account ID"),
];

const createAccount = [
  body("name").trim().isLength({ min: 2, max: 120 }).withMessage("Name is required"),
  body("email").trim().isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").matches(PASSWORD_REGEX).withMessage(PASSWORD_MESSAGE),
];

const updateAccount = [
  ...accountId,
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("email").optional().trim().isEmail().normalizeEmail(),
  body("isActive").optional().isBoolean(),
];

const password = [
  ...accountId,
  body("password").matches(PASSWORD_REGEX).withMessage(PASSWORD_MESSAGE),
];

module.exports = {
  accountId,
  createAccount,
  password,
  updateAccount,
};
