const { body } = require("express-validator");

const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const PUBLIC_SIGNUP_ROLES = ["CUSTOMER"];
const USER_ROLES = ["CUSTOMER", "GARAGE_OWNER"];
const AUTH_ROLES = [...USER_ROLES, "ADMIN", "INTERN", "CUSTOMER_SUPPORT"];

const signupValidation = [
  body("acceptedTerms").custom((value) => value === true).withMessage("You must accept the Terms and Conditions"),
  body("acceptedPrivacy").custom((value) => value === true).withMessage("You must accept the Privacy Policy"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage(
      "Phone number must be a valid Indian mobile number, for example +919812345678",
    ),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 256 })
    .withMessage("Password is too long")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MESSAGE),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .isLength({ max: 256 })
    .withMessage("Confirm password is too long")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(PUBLIC_SIGNUP_ROLES)
    .withMessage("Public registration is available only for CUSTOMER accounts"),
];

const verifyOtpValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage(
      "Phone number must be a valid Indian mobile number, for example +919812345678",
    ),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(PUBLIC_SIGNUP_ROLES)
    .withMessage("Public registration is available only for CUSTOMER accounts"),
];

const resendOtpValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage(
      "Phone number must be a valid Indian mobile number, for example +919812345678",
    ),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(PUBLIC_SIGNUP_ROLES)
    .withMessage("Public registration is available only for CUSTOMER accounts"),
];

const sendPhoneOtpValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage(
      "Phone number must be a valid Indian mobile number, for example +919812345678",
    ),
];

const verifyPhoneOtpValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage(
      "Phone number must be a valid Indian mobile number, for example +919812345678",
    ),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only digits"),
];

const loginValidation = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Email, phone, or staff login ID is required")
    .isLength({ max: 254 })
    .withMessage("Login identifier is too long"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 256 })
    .withMessage("Password is too long"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(AUTH_ROLES)
    .withMessage("Invalid account role"),
];

const staffOtpValidation = [
  body("challengeId")
    .trim()
    .notEmpty()
    .withMessage("Login challenge is required")
    .isUUID()
    .withMessage("Invalid login challenge"),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only digits"),
];

const staffOtpResendValidation = [
  body("challengeId")
    .trim()
    .notEmpty()
    .withMessage("Login challenge is required")
    .isUUID()
    .withMessage("Invalid login challenge"),
];

const googleAuthValidation = [
  body("idToken")
    .trim()
    .notEmpty()
    .withMessage("Firebase ID token is required"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(PUBLIC_SIGNUP_ROLES)
    .withMessage("Google registration is available only for CUSTOMER accounts"),
  body("mode").isIn(["LOGIN", "SIGNUP"]).withMessage("Google authentication mode must be LOGIN or SIGNUP"),
  body("acceptedTerms").optional().isBoolean(),
  body("acceptedPrivacy").optional().isBoolean(),
];

const forgotPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(USER_ROLES)
    .withMessage(
      "Password recovery is available only for CUSTOMER or GARAGE_OWNER accounts",
    ),
];

const resetPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MESSAGE),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(USER_ROLES)
    .withMessage(
      "Password recovery is available only for CUSTOMER or GARAGE_OWNER accounts",
    ),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MESSAGE),
];

module.exports = {
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
};
