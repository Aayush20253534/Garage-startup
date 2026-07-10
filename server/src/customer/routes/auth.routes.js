const express = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../../middlewares/validate.middleware");
const {
  optionalProtect,
  protect,
  protectUser,
} = require("../../middlewares/auth.middleware");

const {
  signupValidation,
  verifyOtpValidation,
  resendOtpValidation,
  sendPhoneOtpValidation,
  verifyPhoneOtpValidation,
  loginValidation,
  googleAuthValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
} = require("../validations/auth.validation");

const rateLimit = require("../../middlewares/rateLimit.middleware");
const {
  otpSendRateLimits,
} = require("../../middlewares/otpRateLimit.middleware");

const router = express.Router();

const otpVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    `${req.ip}:${req.body?.phone || req.body?.email || "otp"}`,
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) =>
    `${req.ip}:${req.body?.identifier || "login"}`,
});

const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) =>
    `${req.ip}:${req.body?.email || "password-reset"}`,
});

router.post(
  "/signup",
  signupValidation,
  validate,
  otpSendRateLimits,
  authController.signup,
);

router.post(
  "/verify-otp",
  otpVerifyRateLimit,
  verifyOtpValidation,
  validate,
  authController.verifyOtp,
);

router.post(
  "/resend-otp",
  resendOtpValidation,
  validate,
  otpSendRateLimits,
  authController.resendOtp,
);

router.post(
  "/send-otp",
  sendPhoneOtpValidation,
  validate,
  otpSendRateLimits,
  authController.sendPhoneOtp,
);

router.post(
  "/verify-phone-otp",
  protectUser,
  otpVerifyRateLimit,
  verifyPhoneOtpValidation,
  validate,
  authController.verifyPhoneOtp,
);

router.post(
  "/login",
  loginRateLimit,
  loginValidation,
  validate,
  authController.login,
);

router.post(
  "/google",
  loginRateLimit,
  googleAuthValidation,
  validate,
  authController.googleAuth,
);

router.post("/logout", optionalProtect, authController.logout);
router.get("/me", protect, authController.me);

router.post(
  "/change-password",
  protect,
  changePasswordValidation,
  validate,
  authController.changePassword,
);

router.post(
  "/forgot-password",
  forgotPasswordValidation,
  validate,
  otpSendRateLimits,
  passwordResetRateLimit,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  passwordResetRateLimit,
  resetPasswordValidation,
  validate,
  authController.resetPassword,
);

module.exports = router;
