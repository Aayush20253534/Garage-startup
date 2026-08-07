const isProduction = () => process.env.NODE_ENV === "production";

const getSecretStrengthBytes = (value = "") =>
  Buffer.byteLength(String(value));

const clean = (value) => String(value || "").trim();

const requireStrongSecret = (name, { minBytes = 32 } = {}) => {
  const value = clean(process.env[name]);

  if (!value || getSecretStrengthBytes(value) < minBytes) {
    throw new Error(
      `${name} must be configured with at least ${minBytes} random bytes`,
    );
  }
};

const requireVariables = (names) => {
  const missing = names.filter((name) => !clean(process.env[name]));

  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
};

const requireOneOf = (names) => {
  if (names.some((name) => clean(process.env[name]))) return;

  throw new Error(
    `At least one of these production environment variables is required: ${names.join(", ")}`,
  );
};


const requireEmail = (name) => {
  const value = clean(process.env[name]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${name} must be a valid email address in production`);
  }
};

const requireHttpsUrl = (name) => {
  const value = clean(process.env[name]);

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("not https");
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL in production`);
  }
};

const validateEnvironment = () => {
  if (!isProduction()) return;

  requireStrongSecret("JWT_SECRET");
  requireStrongSecret("CASHFREE_WEBHOOK_SECRET", { minBytes: 24 });

  requireVariables([
    "DATABASE_URL",
    "REDIS_URL",
    "CASHFREE_APP_ID",
    "CASHFREE_SECRET_KEY",
    "CASHFREE_NOTIFY_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "RESEND_API_KEY",
    "ADMIN_2FA_EMAIL",
    "WHATSAPP_VERIFY_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WEB_PUSH_VAPID_PUBLIC_KEY",
    "WEB_PUSH_VAPID_PRIVATE_KEY",
  ]);

  requireOneOf(["EMAIL_FROM", "RESEND_FROM_EMAIL"]);
  requireOneOf(["CLIENT_URL", "FRONTEND_URL"]);

  const vehicleRegistrationVerificationEnabled =
    clean(process.env.VEHICLE_REGISTRATION_VERIFICATION_ENABLED || "true")
      .toLowerCase() !== "false";
  if (!vehicleRegistrationVerificationEnabled) {
    throw new Error(
      "VEHICLE_REGISTRATION_VERIFICATION_ENABLED cannot be disabled in production",
    );
  }
  requireVariables(["WAY2API_API_KEY"]);
  requireEmail("ADMIN_2FA_EMAIL");

  requireHttpsUrl("CASHFREE_NOTIFY_URL");
  requireHttpsUrl(clean(process.env.CLIENT_URL) ? "CLIENT_URL" : "FRONTEND_URL");

  const databaseUrl = clean(process.env.DATABASE_URL);
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }

  if (clean(process.env.CASHFREE_ENV).toLowerCase() !== "production") {
    throw new Error("CASHFREE_ENV must be set to production in production");
  }

  if (
    clean(process.env.CASHFREE_WEBHOOK_SIGNATURE_REQUIRED).toLowerCase() ===
    "false"
  ) {
    throw new Error(
      "CASHFREE_WEBHOOK_SIGNATURE_REQUIRED cannot be disabled in production",
    );
  }


  if (clean(process.env.EMAIL_OTP_DELIVERY).toLowerCase() !== "email") {
    throw new Error("EMAIL_OTP_DELIVERY must be set to email in production");
  }

  if (clean(process.env.WHATSAPP_DEBUG_LOGS).toLowerCase() === "true") {
    throw new Error("WHATSAPP_DEBUG_LOGS must be false in production");
  }
};

module.exports = {
  validateEnvironment,
};
