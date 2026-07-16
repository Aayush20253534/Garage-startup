const express = require("express");
const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const {
  isWhatsappConfigured,
} = require("../services/garageWhatsapp.service");
const {
  hasWhatsappWebhookFailure,
  isLogFlagEnabled,
  summarizeWhatsappWebhookEvents,
} = require("../utils/logControls");

const router = express.Router();

const getVerifyToken = () =>
  String(
    process.env.WHATSAPP_VERIFY_TOKEN ||
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      "",
  ).trim();

const verifyMetaSignature = (req) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
  const signature = req.get("x-hub-signature-256");

  if (!appSecret || !signature || !req.rawBody) {
    return process.env.NODE_ENV !== "production";
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");

  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

router.get(
  "/webhook",
  asyncHandler(async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = getVerifyToken();

    if (verifyToken && mode === "subscribe" && token === verifyToken) {
      return res.status(200).send(challenge);
    }

    return res.status(403).json({
      success: false,
      message: "WhatsApp webhook verification failed",
    });
  }),
);

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    if (!verifyMetaSignature(req)) {
      return res.status(403).json({
        success: false,
        message: "Invalid WhatsApp webhook signature",
      });
    }

    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    const events = entries.flatMap((entry) =>
      (entry.changes || []).map((change) => ({
        field: change.field,
        value: change.value,
      })),
    );

    if (process.env.NODE_ENV !== "test") {
      const summary = summarizeWhatsappWebhookEvents(req.body?.object, events);
      const hasFailure = hasWhatsappWebhookFailure(events);
      const debugEnabled = isLogFlagEnabled(
        process.env.WHATSAPP_WEBHOOK_DEBUG_LOGS ??
          process.env.WHATSAPP_DEBUG_LOGS,
        false,
      );

      if (hasFailure) {
        console.warn("[whatsapp:webhook] delivery failure", summary);
      } else if (debugEnabled) {
        console.info("[whatsapp:webhook] status", summary);
      }
    }

    return res
      .status(200)
      .json(new ApiResponse(200, "WhatsApp webhook received", { received: true }));
  }),
);

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    return res.status(200).json(
      new ApiResponse(200, "WhatsApp integration status", {
        configured: isWhatsappConfigured(),
        webhookVerificationConfigured: Boolean(getVerifyToken()),
      }),
    );
  }),
);

module.exports = router;
