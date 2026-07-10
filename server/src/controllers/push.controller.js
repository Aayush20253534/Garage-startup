const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const webPushService = require("../services/webPush.service");

const getPublicConfig = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Web Push configuration fetched successfully",
        webPushService.getPublicConfig(),
      ),
    );
});

const subscribe = asyncHandler(async (req, res) => {
  const result = await webPushService.saveSubscription({
    userId: req.user.id,
    subscription: req.body?.subscription,
    deviceName: req.body?.deviceName,
    userAgent: req.get("user-agent"),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Push notifications enabled", result));
});

const unsubscribe = asyncHandler(async (req, res) => {
  const result = await webPushService.removeSubscription({
    userId: req.user.id,
    endpoint: req.body?.endpoint,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Push notifications disabled", result));
});

module.exports = {
  getPublicConfig,
  subscribe,
  unsubscribe,
};
