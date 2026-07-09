const express = require("express");
const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const {
  getWhatsappPhoneNumberId,
  getWhatsappProviderUrl,
} = require("../services/garageWhatsapp.service");

const router = express.Router();

const getVerifyToken = () =>
  process.env.WHATSAPP_VERIFY_TOKEN ||
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
  "rovauto_whatsapp_verify";

const verifyMetaSignature = (req) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
  const signature = req.get("x-hub-signature-256");

  if (!appSecret || !signature || !req.rawBody) return true;

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

    if (mode === "subscribe" && token === getVerifyToken()) {
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
      console.log(
        "[whatsapp:webhook]",
        JSON.stringify(
          {
            object: req.body?.object,
            events: events.map((event) => ({
              field: event.field,
              messages: event.value?.messages?.length || 0,
              statuses: event.value?.statuses?.length || 0,
              statusDetails: (event.value?.statuses || []).map((status) => ({
                id: status.id,
                recipientId: status.recipient_id,
                status: status.status,
                timestamp: status.timestamp,
                conversationId: status.conversation?.id,
                pricingCategory: status.pricing?.category,
                errors: (status.errors || []).map((error) => ({
                  code: error.code,
                  title: error.title,
                  message: error.message || error.error_data?.details,
                })),
              })),
            })),
          },
          null,
          2,
        ),
      );
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
        configured: Boolean(getWhatsappProviderUrl()),
        phoneNumberId: getWhatsappPhoneNumberId() || null,
        providerUrl: getWhatsappProviderUrl() || null,
        webhookPath: "/api/v1/whatsapp/webhook",
      }),
    );
  }),
);

module.exports = router;
