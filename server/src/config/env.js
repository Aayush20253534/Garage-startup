const isProduction = () => process.env.NODE_ENV === "production";

const getSecretStrengthBytes = (value = "") => Buffer.byteLength(String(value));

const requireStrongSecret = (name, { minBytes = 32 } = {}) => {
  const value = process.env[name];

  if (!value || getSecretStrengthBytes(value) < minBytes) {
    throw new Error(
      `${name} must be configured with at least ${minBytes} random bytes`,
    );
  }
};

const validateEnvironment = () => {
  if (!isProduction()) return;

  requireStrongSecret("JWT_SECRET");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }
};

module.exports = {
  validateEnvironment,
};
