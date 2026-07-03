const { body, param, query } = require("express-validator");

const submitGarageApplicationSchema = [
  body("ownerName").trim().notEmpty().withMessage("Owner name is required"),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("phone").trim().notEmpty().withMessage("Phone is required"),
  body("garageName").trim().notEmpty().withMessage("Garage name is required"),
  body("description").optional({ nullable: true, checkFalsy: true }).trim(),
  body("address").trim().notEmpty().withMessage("Address is required"),
  body("city").trim().notEmpty().withMessage("City is required"),
  body("area").trim().notEmpty().withMessage("Area is required"),
  body("latitude").optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage("Latitude must be valid"),
  body("longitude").optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage("Longitude must be valid"),
  body("workingRadiusKm")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage("Working radius must be between 1 and 100 km"),
];

const geocodeGarageApplicationSchema = [
  query("address").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 300 }),
  query("city").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("state").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("pincode").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 20 }),
  query("country").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("countrycodes").optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 8 }),
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
  body("adminNote").optional({ nullable: true, checkFalsy: true }).trim(),
];

module.exports = {
  applicationIdSchema,
  applicationQuerySchema,
  geocodeGarageApplicationSchema,
  reviewApplicationSchema,
  submitGarageApplicationSchema,
};
