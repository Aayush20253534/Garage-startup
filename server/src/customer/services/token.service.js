const { generateToken } = require("../../utils/jwt");

const STAFF_ROLES = new Set(["ADMIN", "INTERN"]);

const createAuthToken = (account, { sessionId = null } = {}) => {
  if (!account?.id || !account?.role) {
    throw new Error("Cannot create an auth token without an account ID and role");
  }

  const accountType =
    account.accountType ||
    (account.role === "CUSTOMER_SUPPORT"
      ? "CUSTOMER_SUPPORT"
      : STAFF_ROLES.has(account.role)
        ? "STAFF"
        : "USER");

  return generateToken({
    id: account.id,
    role: account.role,
    accountType,
    ...(sessionId ? { sessionId } : {}),
  });
};

module.exports = {
  createAuthToken,
};
