const express = require("express");

const customerController = require("../controllers/customer.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");
const {
  onboardingValidation,
  updateProfileValidation,
  deleteAccountValidation,
} = require("../validations/customer.validation");
const {
  changePasswordValidation,
} = require("../validations/auth.validation");

const router = express.Router();
const avatarUpload = upload.createUpload({
  fileSize: 2 * 1024 * 1024,
  files: 1,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
}).single("avatar");

router.post(
  "/onboarding",
  protect,
  onboardingValidation,
  validate,
  customerController.completeOnboarding
);

router.get("/profile", protect, customerController.getProfile);

router.post(
  "/profile/avatar",
  protect,
  avatarUpload,
  upload.validateUploadedFiles,
  customerController.uploadProfileAvatar,
);

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
