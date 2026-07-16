const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasWhatsappWebhookFailure,
  isLogFlagEnabled,
  maskIdentifier,
  summarizeWhatsappWebhookEvents,
} = require("../../src/utils/logControls");

const statusEvent = (status, errors = []) => [
  {
    field: "messages",
    value: {
      statuses: [
        {
          id: "wamid.HBgMOTE4OTM2MDkxMDI1",
          recipient_id: "918936091025",
          status,
          timestamp: "1784177691",
          errors,
        },
      ],
    },
  },
];

test("debug logging is opt-in and accepts explicit boolean values", () => {
  assert.equal(isLogFlagEnabled(undefined), false);
  assert.equal(isLogFlagEnabled("false", true), false);
  assert.equal(isLogFlagEnabled("1"), true);
  assert.equal(isLogFlagEnabled("unexpected"), false);
});

test("successful WhatsApp status callbacks are not classified as failures", () => {
  assert.equal(hasWhatsappWebhookFailure(statusEvent("sent")), false);
  assert.equal(hasWhatsappWebhookFailure(statusEvent("delivered")), false);
  assert.equal(
    hasWhatsappWebhookFailure(
      statusEvent("failed", [{ code: 131000, title: "Something went wrong" }]),
    ),
    true,
  );
});

test("WhatsApp webhook summaries mask recipient and provider identifiers", () => {
  const summary = summarizeWhatsappWebhookEvents(
    "whatsapp_business_account",
    statusEvent("delivered"),
  );
  const details = summary.events[0].statusDetails[0];

  assert.equal(details.recipientId.endsWith("1025"), true);
  assert.equal(details.recipientId.includes("91893609"), false);
  assert.equal(details.id.includes("HBgMOTE4OTM2"), false);
  assert.equal(maskIdentifier("1234", 4), "****");
});
