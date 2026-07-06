const {
  calculatePlatformFee: calculateNormalPlatformFee,
} = require("../utils/platformFee");

const GARAGE_MINIMUM_ACTIVATION_RECHARGE = 100;
const GARAGE_MAXIMUM_IMAGES = 15;
const GARAGE_MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const REQUIRED_BOOKING_INSPECTION_IMAGES = 5;

const calculatePlatformFee = (serviceUpperLimit, requestType = "NORMAL") => {
  if (requestType === "SOS") return 50;

  return calculateNormalPlatformFee(serviceUpperLimit);
};

module.exports = {
  GARAGE_MINIMUM_ACTIVATION_RECHARGE,
  GARAGE_MAXIMUM_IMAGES,
  GARAGE_MAX_IMAGE_SIZE_BYTES,
  REQUIRED_BOOKING_INSPECTION_IMAGES,
  calculatePlatformFee,
};
