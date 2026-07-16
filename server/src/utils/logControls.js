const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);

const isLogFlagEnabled = (value, defaultValue = false) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
};

const maskIdentifier = (value, visibleCharacters = 4) => {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;

  const visible = Math.max(0, Number(visibleCharacters) || 0);
  if (normalized.length <= visible) return "*".repeat(normalized.length);

  return `${"*".repeat(normalized.length - visible)}${normalized.slice(-visible)}`;
};

const summarizeWhatsappWebhookEvents = (object, events = []) => ({
  object,
  events: events.map((event) => ({
    field: event.field,
    messages: event.value?.messages?.length || 0,
    statuses: event.value?.statuses?.length || 0,
    statusDetails: (event.value?.statuses || []).map((status) => ({
      id: maskIdentifier(status.id, 6),
      recipientId: maskIdentifier(status.recipient_id, 4),
      status: status.status,
      timestamp: status.timestamp,
      conversationId: maskIdentifier(status.conversation?.id, 6),
      pricingCategory: status.pricing?.category,
      errors: (status.errors || []).map((error) => ({
        code: error.code,
        title: error.title,
        message: error.message || error.error_data?.details,
      })),
    })),
  })),
});

const hasWhatsappWebhookFailure = (events = []) =>
  events.some((event) =>
    (event.value?.statuses || []).some(
      (status) => status.status === "failed" || (status.errors || []).length > 0,
    ),
  );

module.exports = {
  hasWhatsappWebhookFailure,
  isLogFlagEnabled,
  maskIdentifier,
  summarizeWhatsappWebhookEvents,
};
