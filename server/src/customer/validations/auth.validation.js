const { body } = require("express-validator");

const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and symbol";
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const signupValidation = [
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
    .withMessage("Phone number must be a valid Indian mobile number, for example +919812345678"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MESSAGE),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(["CUSTOMER", "GARAGE_OWNER"])
    .withMessage("Role must be either CUSTOMER or GARAGE_OWNER"),
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
    .withMessage("Phone number must be a valid Indian mobile number, for example +919812345678"),

  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(["CUSTOMER", "GARAGE_OWNER"])
    .withMessage("Role must be either CUSTOMER or GARAGE_OWNER"),
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
    .withMessage("Phone number must be a valid Indian mobile number, for example +919812345678"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(["CUSTOMER", "GARAGE_OWNER"])
    .withMessage("Role must be either CUSTOMER or GARAGE_OWNER"),
];

const sendPhoneOtpValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage("Phone number must be a valid Indian mobile number, for example +919812345678"),
];

const verifyPhoneOtpValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage("Phone number must be a valid Indian mobile number, for example +919812345678"),

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
    .withMessage("Email or phone is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(["CUSTOMER", "GARAGE_OWNER", "ADMIN"])
    .withMessage("Invalid account role"),
];

const googleAuthValidation = [
  body("idToken")
    .trim()
    .notEmpty()
    .withMessage("Firebase ID token is required"),

  body("role")
    .optional({ checkFalsy: true })
    .trim()
    .isIn(["CUSTOMER", "GARAGE_OWNER"])
    .withMessage("Role must be either CUSTOMER or GARAGE_OWNER"),
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
    .isIn(["CUSTOMER", "GARAGE_OWNER", "ADMIN"])
    .withMessage("Invalid account role"),
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
    .isIn(["CUSTOMER", "GARAGE_OWNER", "ADMIN"])
    .withMessage("Invalid account role"),
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
  googleAuthValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
};
