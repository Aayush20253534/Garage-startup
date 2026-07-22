import api from "@/api/axios";

const VALID_ACCOUNT_TYPES = new Set(["USER", "STAFF", "CUSTOMER_SUPPORT", "GARAGE_CONTROLLER"]);
const VALID_ROLES = new Set([
  "CUSTOMER",
  "GARAGE_OWNER",
  "GARAGE_CONTROLLER",
  "ADMIN",
  "INTERN",
  "CUSTOMER_SUPPORT",
]);

export const verifyCurrentSession = async ({
  expectedRole,
  portal,
} = {}) => {
  const supportPortal =
    portal === "support" || expectedRole === "CUSTOMER_SUPPORT";
  const response = await api.get(
    supportPortal ? "/auth/support/me" : "/auth/me",
    {
      skipSessionExpiryMessage: true,
      skipErrorReporting: true,
      sessionScope: supportPortal ? "support" : "main",
    },
  );

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
