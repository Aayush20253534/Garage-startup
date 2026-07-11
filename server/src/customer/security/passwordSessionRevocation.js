const ApiError = require("../../utils/apiError");

const getPasswordChangeSessionRevocation = ({
  accountType,
  accountId,
  currentSessionId = null,
}) => {
  const id = String(accountId || "").trim();
  if (!id) throw new ApiError(400, "Account ID is required");

  if (accountType === "USER") {
    return {
      model: "userSession",
      where: {
        userId: id,
        revokedAt: null,
        ...(currentSessionId
          ? { id: { not: String(currentSessionId) } }
          : {}),
      },
    };
  }

  if (accountType === "STAFF") {
    return {
      model: "staffSession",
      where: {
        staffAccountId: id,
        revokedAt: null,
      },
    };
  }

  throw new ApiError(400, "Unsupported account type for session revocation");
};

module.exports = { getPasswordChangeSessionRevocation };
