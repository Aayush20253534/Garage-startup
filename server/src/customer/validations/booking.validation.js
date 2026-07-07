const { body, param } = require("express-validator");

const bookingIdValidation = [
  param("id").isUUID().withMessage("Invalid booking ID"),
];

const acceptDeliveryValidation = bookingIdValidation;

const createBookingValidation = [
  body("vehicleId").isUUID().withMessage("Valid vehicle ID is required"),

  body("serviceIds")
    .isArray({ min: 1 })
    .withMessage("At least one service is required"),

  body("serviceIds.*").isUUID().withMessage("Each service ID must be valid"),

  body("scheduledDate")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("Scheduled date must be valid"),

  body("startTime")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("endTime")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("customerNote")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("location")
    .notEmpty()
    .withMessage("Customer location is required")
    .isObject()
    .withMessage("Location must be an object"),

  body("location.latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Valid latitude is required"),

  body("location.longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Valid longitude is required"),

  body("location.address")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("location.city")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("location.placeId")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 }),

  body("useWalletCoins")
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage("Wallet coins must be a positive number"),
];

module.exports = {
  bookingIdValidation,
  createBookingValidation,
  acceptDeliveryValidation,
};
