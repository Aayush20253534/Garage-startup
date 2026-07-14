const cleanText = (value = "") =>
  String(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const redactSensitiveText = (value = "") => {
  let text = cleanText(value);

  text = text
    .replace(
      /\b(otp|one[-\s]?time password|verification code|security code|pin)\b(\s*(?:is|:|=|-)?\s*)\d{4,8}\b/gi,
      "$1$2[REDACTED]",
    )
    .replace(
      /\b(password|passcode|secret|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\b(\s*(?:is|:|=|-)?\s*)[^\s,;]+/gi,
      "$1$2[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:sk|pk|rk)_[A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_KEY]")
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[REDACTED_EMAIL]",
    )
    .replace(
      /(?<!\d)(?:\+?91[ -]?)?[6-9]\d{9}(?!\d)/g,
      "[REDACTED_PHONE]",
    );

  text = text.replace(/(?:\d[ -]?){13,19}/g, (candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19
      ? "[REDACTED_PAYMENT_NUMBER]"
      : candidate;
  });

  return text;
};

const sanitizeAssistantAnswer = (value = "") =>
  redactSensitiveText(value)
    .replace(/\b(?:server|client)\/src\/[^\s)]+/gi, "[internal detail removed]")
    .replace(/\/api\/v1\/(?:admin|intern|customer-support)\/[^\s)]+/gi, "[internal route removed]");

const addPrivacyNotice = (answer, sensitiveDataRemoved) =>
  sensitiveDataRemoved
    ? `For your security, I removed contact or credential details from your message. Please use Rovauto's secure forms for OTPs, passwords, payments, and account changes.\n\n${answer}`
    : answer;

module.exports = {
  cleanText,
  redactSensitiveText,
  sanitizeAssistantAnswer,
  addPrivacyNotice,
};
