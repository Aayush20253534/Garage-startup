const express = require("express");

const customerController = require("../controllers/customer.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  onboardingValidation,
  updateProfileValidation,
  deleteAccountValidation,
} = require("../validations/customer.validation");
const {
  changePasswordValidation,
} = require("../validations/auth.validation");

const router = express.Router();

router.post(
  "/onboarding",
  protect,
  onboardingValidation,
  validate,
  customerController.completeOnboarding
);

router.get("/profile", protect, customerController.getProfile);

router.patch(
  "/profile",
  protect,
  updateProfileValidation,
  validate,
  customerController.updateProfile
);
router.patch(
  "/change-password",
  protect,
  changePasswordValidation,
  validate,
  customerController.changePassword
);

router.delete(
  "/delete-account",
  protect,
  deleteAccountValidation,
  validate,
  customerController.deleteAccount
);

module.exports = router;
