const { body, param } = require("express-validator");
const { getExpectedConfirmation } = require("../services/dangerous.service");

const commandParamSchema = [
  param("command")
    .trim()
    .notEmpty()
    .withMessage("Command is required")
    .isLength({ max: 80 })
    .withMessage("Command is too long"),
];

const runDangerousCommandSchema = [
  ...commandParamSchema,

  body("confirmation")
    .isString()
    .withMessage("Confirmation is required")
    .custom((value, { req }) => value === getExpectedConfirmation(req.params.command))
    .withMessage((value, { req }) =>
      `Type ${getExpectedConfirmation(req.params.command)} to continue`,
    ),

  body("payload")
    .optional({ nullable: true })
    .isObject()
    .withMessage("Payload must be an object"),
];

module.exports = {
  runDangerousCommandSchema,
};
