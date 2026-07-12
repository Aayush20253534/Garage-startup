const express = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../../middlewares/validate.middleware");
const {
  optionalProtect,
  protect,
  protectCustomerSupport,
  protectUser,
} = require("../../middlewares/auth.middleware");

const {
  signupValidation,
  verifyOtpValidation,
  resendOtpValidation,
  sendPhoneOtpValidation,
  verifyPhoneOtpValidation,
  loginValidation,
  staffOtpValidation,
  staffOtpResendValidation,
  googleAuthValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
} = require("../validations/auth.validation");

const rateLimit = require("../../middlewares/rateLimit.middleware");
const concurrencyLimit = require("../../middlewares/concurrencyLimit.middleware");
const {
  otpSendRateLimits,
} = require("../../middlewares/otpRateLimit.middleware");

const router = express.Router();
const authConcurrencyLimit = concurrencyLimit({
  max: Number(process.env.AUTH_MAX_CONCURRENT_REQUESTS || 50),
});

const loginIpRateLimit = rateLimit({
  name: "login-ip",
  windowMs: 15 * 60 * 1000,
  max: 30,
  fallbackMax: 10,
  keyGenerator: (req) => req.ip,
});

const otpVerifyIpRateLimit = rateLimit({
  name: "otp-verify-ip",
  windowMs: 15 * 60 * 1000,
  max: 30,
  fallbackMax: 10,
  keyGenerator: (req) => req.ip,
});

const passwordResetIpRateLimit = rateLimit({
  name: "password-reset-ip",
  windowMs: 60 * 60 * 1000,
  max: 20,
  fallbackMax: 8,
  keyGenerator: (req) => req.ip,
});

const otpVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  fallbackMax: 4,
  keyGenerator: (req) =>
    `${req.ip}:${req.body?.phone || req.body?.email || "otp"}`,
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  fallbackMax: 4,
  keyGenerator: (req) =>
    `${req.ip}:${req.body?.identifier || "login"}`,
});

const staffOtpVerifyRateLimit = rateLimit({
  name: "staff-2fa-verify",
  windowMs: 15 * 60 * 1000,
  max: 10,
  fallbackMax: 5,
  keyGenerator: (req) => `${req.ip}:${req.body?.challengeId || "staff-2fa"}`,
});

const staffOtpResendRateLimit = rateLimit({
  name: "staff-2fa-resend",
  windowMs: 60 * 60 * 1000,
  max: 5,
  fallbackMax: 3,
  keyGenerator: (req) => `${req.ip}:${req.body?.challengeId || "staff-2fa"}`,
});

const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  fallbackMax: 2,
  keyGenerator: (req) =>
    `${req.ip}:${req.body?.email || "password-reset"}`,
});

router.post(
  "/signup",
  authConcurrencyLimit,
  signupValidation,
  validate,
  otpSendRateLimits,
  authController.signup,
);

router.post(
  "/verify-otp",
  otpVerifyIpRateLimit,
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
  otpVerifyIpRateLimit,
  otpVerifyRateLimit,
  verifyPhoneOtpValidation,
  validate,
  authController.verifyPhoneOtp,
);

router.post(
  "/support/login",
  authConcurrencyLimit,
  loginIpRateLimit,
  loginRateLimit,
  loginValidation,
  validate,
  authController.supportLogin,
);
router.post(
  "/support/logout",
  protectCustomerSupport,
  authController.supportLogout,
);
router.get(
  "/support/me",
  protectCustomerSupport,
  authController.supportMe,
);

router.post(
  "/login",
  authConcurrencyLimit,
  loginIpRateLimit,
  loginRateLimit,
  loginValidation,
  validate,
  authController.login,
);

router.post(
  "/staff/verify-otp",
  staffOtpVerifyRateLimit,
  staffOtpValidation,
  validate,
  authController.verifyStaffLoginOtp,
);

router.post(
  "/staff/resend-otp",
  staffOtpResendRateLimit,
  staffOtpResendValidation,
  validate,
  authController.resendStaffLoginOtp,
);

router.post(
  "/google",
  authConcurrencyLimit,
  loginIpRateLimit,
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
  passwordResetIpRateLimit,
  forgotPasswordValidation,
  validate,
  otpSendRateLimits,
  passwordResetRateLimit,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  authConcurrencyLimit,
  passwordResetIpRateLimit,
  passwordResetRateLimit,
  resetPasswordValidation,
  validate,
  authController.resetPassword,
);

module.exports = router;
