const { body } = require("express-validator");

const reportSystemIssueSchema = [
  body("message")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Issue message is required")
    .isLength({ max: 2000 })
    .withMessage("Issue message is too long"),
  body("title").optional({ nullable: true }).isString().trim().isLength({ max: 180 }),
  body("stack").optional({ nullable: true }).isString().isLength({ max: 12000 }),
  body("severity")
    .optional({ nullable: true })
    .isIn(["INFO", "WARNING", "ERROR", "CRITICAL"]),
  body("actorType")
    .optional({ nullable: true })
    .isIn(["CUSTOMER", "GARAGE", "ADMIN", "INTERN", "CUSTOMER_SUPPORT", "PUBLIC", "SYSTEM"]),
  body("route").optional({ nullable: true }).isString().isLength({ max: 500 }),
  body("method").optional({ nullable: true }).isString().isLength({ max: 12 }),
  body("endpoint").optional({ nullable: true }).isString().isLength({ max: 500 }),
  body("httpStatus").optional({ nullable: true }).isInt({ min: 0, max: 599 }),
  body("errorName").optional({ nullable: true }).isString().isLength({ max: 120 }),
  body("component").optional({ nullable: true }).isString().isLength({ max: 180 }),
  body("environment").optional({ nullable: true }).isString().isLength({ max: 60 }),
  body("release").optional({ nullable: true }).isString().isLength({ max: 120 }),
  body("userAgent").optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body("metadata").optional({ nullable: true }).isObject(),
];

module.exports = {
  reportSystemIssueSchema,
};
