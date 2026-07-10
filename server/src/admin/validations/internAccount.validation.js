const { body, param } = require("express-validator");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const LOGIN_ID_REGEX = /^[a-zA-Z0-9._-]{3,60}$/;
const LOGIN_ID_MESSAGE =
  "Intern ID must be 3-60 characters and use only letters, numbers, dots, underscores, or hyphens";

const accountId = [
  param("accountId").isUUID().withMessage("Invalid intern account ID"),
];

const createAccount = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Name is required"),
  body("loginId")
    .trim()
    .matches(LOGIN_ID_REGEX)
    .withMessage(LOGIN_ID_MESSAGE),
  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Enter a valid email address"),
  body("password").matches(PASSWORD_REGEX).withMessage(PASSWORD_MESSAGE),
];

const updateAccount = [
  ...accountId,
  body("name").optional().trim().isLength({ min: 2, max: 120 }),
  body("loginId")
    .optional()
    .trim()
    .matches(LOGIN_ID_REGEX)
    .withMessage(LOGIN_ID_MESSAGE),
  body("email")
    .optional({ nullable: true })
    .custom((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .withMessage("Enter a valid email address"),
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
