const { body, param, query } = require("express-validator");

const submitGarageApplicationSchema = [
  body("ownerName").trim().notEmpty().withMessage("Owner name is required"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("phone")
    .trim()
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage("Enter a valid 10-digit Indian mobile number"),

  body("garageName").trim().notEmpty().withMessage("Garage name is required"),

  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("address").trim().notEmpty().withMessage("Address is required"),
  body("city").trim().notEmpty().withMessage("City is required"),
  body("area").trim().notEmpty().withMessage("Area is required"),

  body("latitude")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 6, max: 38 })
    .withMessage("Latitude must be within India"),

  body("longitude")
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 68, max: 98 })
    .withMessage("Longitude must be within India"),

  body("placeId")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 }),

  body("workingRadiusKm")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage("Working radius must be between 1 and 100 km"),
];

const geocodeGarageApplicationSchema = [
  query("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .withMessage("Address must be at most 300 characters"),

  query("area")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Area must be at most 120 characters"),

  query("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("City must be at most 120 characters"),

  query("state")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("State must be at most 120 characters"),

  query("pincode")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^\d{5,6}$/)
    .withMessage("Pincode must contain 5 or 6 digits"),

  query("country")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Country must be at most 120 characters"),
];

const applicationIdSchema = [
  param("applicationId").isUUID().withMessage("Invalid application ID"),
];

const applicationQuerySchema = [
  query("status")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["PENDING", "CHANGES_REQUESTED", "APPROVED", "DENIED"])
    .withMessage("Invalid application status"),
];

const reviewApplicationSchema = [
  ...applicationIdSchema,
  body("adminNote")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
];

module.exports = {
  applicationIdSchema,
  applicationQuerySchema,
  geocodeGarageApplicationSchema,
  reviewApplicationSchema,
  submitGarageApplicationSchema,
};
