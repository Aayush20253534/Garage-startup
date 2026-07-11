const express = require("express");

const contactController = require("../controllers/contact.controller");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const validate = require("../../middlewares/validate.middleware");

const {
  contactMessageValidation,
} = require("../validations/contact.validation");

const router = express.Router();

const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  fallbackMax: 2,
  keyGenerator: (req) => `contact:${req.ip}:${req.body?.email || "anonymous"}`,
});

router.post(
  "/",
  contactRateLimit,
  contactMessageValidation,
  validate,
  contactController.sendContactMessage
);

module.exports = router;
