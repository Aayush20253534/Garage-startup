const { body, param, query } = require("express-validator");

const garageRequestIdParamSchema = [
  param("requestId").isUUID().withMessage("Invalid request ID"),
];

const serviceHistoryQuerySchema = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("History limit must be between 1 and 50"),
  query("cursor")
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage("Invalid service history cursor"),
];

const rejectGarageRequestSchema = [
  param("requestId").isUUID().withMessage("Invalid request ID"),

  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Note cannot exceed 500 characters"),
];

const verifyHandoverOtpSchema = [
  param("requestId").isUUID().withMessage("Invalid request ID"),
  body("otp").trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage("Valid 6 digit OTP is required"),
];

const markDeliveredSchema = [
  param("requestId").isUUID().withMessage("Invalid request ID"),
];

const bookingStageMutationSchema = [
  param("requestId").isUUID().withMessage("Invalid request ID"),
];

const acceptGarageRequestSchema = [
  param("requestId").isUUID().withMessage("Invalid request ID"),

  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Note cannot exceed 500 characters"),
];

module.exports = {
  garageRequestIdParamSchema,
  serviceHistoryQuerySchema,
  rejectGarageRequestSchema,
  acceptGarageRequestSchema,
  verifyHandoverOtpSchema,
  markDeliveredSchema,
  bookingStageMutationSchema,
};
