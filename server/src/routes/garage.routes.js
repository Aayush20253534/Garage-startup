const express = require("express");

const garageController = require("../controllers/garage.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  deleteGarageAccountValidation,
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


router.get("/", garageController.getGarages);

router.get(
  "/nearby",
  protect,
  authorizeRoles("CUSTOMER", "ADMIN"),
  garageController.getNearbyGarages,
);

router.get(
  "/me",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageController.getMyGarage,
);

router.get(
  "/me/services",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageController.getMyGarageServices,
);

router.put(
  "/me",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageController.updateMyGarage,
);

router.post(
  "/me/delete-otp",
  protect,
  authorizeRoles("GARAGE_OWNER"),
  deletionOtpRateLimit,
  garageController.requestGarageAccountDeletionOtp,
);

router.delete(
  "/me",
  protect,
  authorizeRoles("GARAGE_OWNER"),
  deletionVerifyRateLimit,
  deleteGarageAccountValidation,
  validate,
  garageController.deleteMyGarageAccount,
);

router.get("/:id", garageController.getGarageById);
router.get("/:id/services", garageController.getGarageServices);

module.exports = router;
