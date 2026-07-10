import api from "@/api/axios";

const VALID_ACCOUNT_TYPES = new Set(["USER", "STAFF", "CUSTOMER_SUPPORT"]);
const VALID_ROLES = new Set([
  "CUSTOMER",
  "GARAGE_OWNER",
  "ADMIN",
  "INTERN",
  "CUSTOMER_SUPPORT",
]);

export const verifyCurrentSession = async ({ expectedRole } = {}) => {
  const response = await api.get("/auth/me", {
    skipSessionExpiryMessage: true,
    skipErrorReporting: true,
  });

  const account = response.data?.data;

  if (
    !account ||
    !VALID_ACCOUNT_TYPES.has(account.accountType) ||
    !VALID_ROLES.has(account.role)
  ) {
    throw new Error("The server did not return a valid authenticated session.");
  }

  if (expectedRole && account.role !== expectedRole) {
    throw new Error(`Expected a ${expectedRole} session, but received ${account.role}.`);
  }

  return account;
};
