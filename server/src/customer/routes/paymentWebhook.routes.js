const express = require("express");

const paymentWebhookController = require("../controllers/paymentWebhook.controller");
const rateLimit = require("../../middlewares/rateLimit.middleware");

const router = express.Router();

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => `cashfree-webhook:${req.ip}`,
});

router.post(
  "/",
  webhookRateLimit,
  paymentWebhookController.handleCashfreeWebhook,
);

module.exports = router;
