const express = require("express");

const controller = require("../controllers/systemIssue.controller");
const { optionalProtect } = require("../middlewares/auth.middleware");
const rateLimit = require("../middlewares/rateLimit.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  reportSystemIssueSchema,
} = require("../validations/systemIssue.validation");

const router = express.Router();

const reportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  fallbackMax: 3,
  keyGenerator: (req) => `system-issue:${req.ip}`,
});

router.post(
  "/report",
  optionalProtect,
  reportRateLimit,
  reportSystemIssueSchema,
  validate,
  controller.reportSystemIssue,
);

module.exports = router;
