const ApiError = require("../../utils/apiError");

const STAFF_OTP_EXPIRY_MS = 5 * 60 * 1000;
const STAFF_OTP_MAX_ATTEMPTS = 5;
const STAFF_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const getAdminDeliveryEmail = () => normalizeEmail(process.env.ADMIN_2FA_EMAIL);

const resolveDeliveryEmail = ({ role, email }) => {
  const deliveryEmail = role === "ADMIN" ? getAdminDeliveryEmail() : normalizeEmail(email);

  if (!deliveryEmail || !deliveryEmail.includes("@")) {
    throw new ApiError(
      500,
      role === "ADMIN"
        ? "Admin two-factor email is not configured"
        : "This staff account does not have a valid email for two-factor login",
    );
  }

  return deliveryEmail;
};

module.exports = {
  STAFF_OTP_EXPIRY_MS,
  STAFF_OTP_MAX_ATTEMPTS,
  STAFF_OTP_RESEND_COOLDOWN_MS,
  normalizeEmail,
  resolveDeliveryEmail,
};
