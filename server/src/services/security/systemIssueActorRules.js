const ALLOWED_INTERNAL_ACTOR_TYPES = new Set([
  "CUSTOMER",
  "GARAGE",
  "ADMIN",
  "INTERN",
  "CUSTOMER_SUPPORT",
  "PUBLIC",
  "SYSTEM",
]);

const deriveSystemIssueActor = ({ account = null, payloadActorType, hasRequest }) => {
  if (!account) {
    if (hasRequest) {
      return { actorType: "PUBLIC", userId: null, garageId: null, needsGarageLookup: false };
    }

    return {
      actorType: ALLOWED_INTERNAL_ACTOR_TYPES.has(payloadActorType)
        ? payloadActorType
        : "SYSTEM",
      userId: null,
      garageId: null,
      needsGarageLookup: false,
    };
  }

  if (account.accountType === "CUSTOMER_SUPPORT") {
    return {
      actorType: "CUSTOMER_SUPPORT",
      userId: account.id,
      garageId: null,
      needsGarageLookup: false,
    };
  }

  if (account.accountType === "STAFF" || ["ADMIN", "INTERN"].includes(account.role)) {
    return {
      actorType: account.role === "INTERN" ? "INTERN" : "ADMIN",
      userId: account.id,
      garageId: null,
      needsGarageLookup: false,
    };
  }

  if (account.role === "GARAGE_OWNER") {
    return {
      actorType: "GARAGE",
      userId: account.id,
      garageId: null,
      needsGarageLookup: true,
    };
  }

  return {
    actorType: "CUSTOMER",
    userId: account.id,
    garageId: null,
    needsGarageLookup: false,
  };
};

module.exports = {
  ALLOWED_INTERNAL_ACTOR_TYPES,
  deriveSystemIssueActor,
};
