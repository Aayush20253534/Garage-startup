const { body, param } = require("express-validator");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";

const accountId = [
  param("accountId").isUUID().withMessage("Invalid admin account ID"),
];

const createAccount = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Name is required"),
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Enter a valid email address"),
  body("password").matches(PASSWORD_REGEX).withMessage(PASSWORD_MESSAGE),
  body("role")
    .optional()
    .isIn(["ADMIN", "SUB_ADMIN"])
    .withMessage("Role must be ADMIN or SUB_ADMIN"),
];

const updateAccount = [
  ...accountId,
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Enter a valid email address"),
  body("isActive").optional().isBoolean(),
  body("role")
    .optional()
    .isIn(["ADMIN", "SUB_ADMIN"])
    .withMessage("Role must be ADMIN or SUB_ADMIN"),
];

const password = [
  ...accountId,
  body("password").matches(PASSWORD_REGEX).withMessage(PASSWORD_MESSAGE),
];

module.exports = { createAccount, updateAccount, password };
