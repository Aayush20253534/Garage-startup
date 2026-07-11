const { body, param, query } = require("express-validator");

const issueIdSchema = [
  param("issueId").isUUID().withMessage("Invalid system issue ID"),
];

const issueQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("status")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"]),
  query("severity")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["INFO", "WARNING", "ERROR", "CRITICAL"]),
  query("source")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["FRONTEND", "BACKEND"]),
  query("actorType")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["CUSTOMER", "GARAGE", "ADMIN", "INTERN", "CUSTOMER_SUPPORT", "PUBLIC", "SYSTEM"]),
  query("page").optional({ nullable: true }).isInt({ min: 1 }),
  query("limit").optional({ nullable: true }).isInt({ min: 1, max: 100 }),
];

const updateIssueStatusSchema = [
  ...issueIdSchema,
  body("status")
    .isIn(["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"])
    .withMessage("Invalid issue status"),
  body("resolutionNote")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
];

module.exports = {
  issueIdSchema,
  issueQuerySchema,
  updateIssueStatusSchema,
};
