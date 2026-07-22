const express = require("express");

const garageController = require("../controllers/garage.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  deleteGarageAccountValidation,
  updateGarageAccountValidation,
} = require("../validations/garageAccount.validation");
const rateLimit = require("../middlewares/rateLimit.middleware");

const router = express.Router();
const deletionOtpRateLimit = rateLimit({
  name: "garage-delete-otp",
  windowMs: 60 * 60 * 1000,
  max: 5,
  fallbackMax: 3,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || "garage"}`,
});

const deletionVerifyRateLimit = rateLimit({
  name: "garage-delete-verify",
  windowMs: 15 * 60 * 1000,
  max: 10,
  fallbackMax: 5,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || "garage"}`,
});


router.get(
  "/me",
  protect,
  authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER"),
  garageController.getMyGarage,
);

router.get(
  "/me/services",
  protect,
  authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER"),
  garageController.getMyGarageServices,
);

router.put(
  "/me",
  protectUser,
  authorizeRoles("GARAGE_OWNER"),
  updateGarageAccountValidation,
  validate,
  garageController.updateMyGarage,
);

router.post(
  "/me/delete-otp",
  protectUser,
  authorizeRoles("GARAGE_OWNER"),
  deletionOtpRateLimit,
  garageController.requestGarageAccountDeletionOtp,
);

router.delete(
  "/me",
  protectUser,
  authorizeRoles("GARAGE_OWNER"),
  deletionVerifyRateLimit,
  deleteGarageAccountValidation,
  validate,
  garageController.deleteMyGarageAccount,
);

module.exports = router;
