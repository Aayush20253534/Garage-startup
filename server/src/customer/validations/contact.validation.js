const { body } = require("express-validator");

const contactMessageValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Name must be 2 to 120 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 10, max: 3000 })
    .withMessage("Message must be 10 to 3000 characters"),
];

module.exports = {
  contactMessageValidation,
};
