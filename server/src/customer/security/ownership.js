const ApiError = require("../../utils/apiError");

const buildOwnedResourceWhere = ({ id, userId }) => {
  const resourceId = String(id || "").trim();
  const ownerId = String(userId || "").trim();

  if (!resourceId || !ownerId) {
    throw new ApiError(400, "Resource ID and authenticated user are required");
  }

  return { id: resourceId, userId: ownerId };
};

module.exports = { buildOwnedResourceWhere };
