const { body } = require("express-validator");

const createPaymentOrderValidation = [
  body("bookingId").isUUID().withMessage("Valid booking ID is required"),
];

const verifyPaymentValidation = [
  body("bookingId").isUUID().withMessage("Valid booking ID is required"),

  body("cashfreeOrderId")
    .trim()
    .notEmpty()
    .withMessage("Cashfree order ID is required"),
];

const cancelPaymentOrderValidation = [
  body("bookingId").isUUID().withMessage("Valid booking ID is required"),
];

module.exports = {
  cancelPaymentOrderValidation,
  createPaymentOrderValidation,
  verifyPaymentValidation,
};
