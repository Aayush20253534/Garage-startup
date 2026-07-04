const { body, query } = require("express-validator");

const walletRechargeSchema = [
  body("amount")
    .isInt({ min: 100 })
    .withMessage("Recharge amount must be at least ₹100"),

  body("paymentMethod")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["CASHFREE", "UPI"])
    .withMessage("Payment method must be CASHFREE or UPI"),
];

const useWalletSchema = [
  body("amount")
    .isInt({ min: 1 })
    .withMessage("Wallet amount must be at least 1 coin"),
];

const walletTransactionQuerySchema = [
  query("page")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("Page must be at least 1"),

  query("limit")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("type")
    .optional({ nullable: true, checkFalsy: true })
    .isIn([
      "CREDIT",
      "DEBIT",
      "RECHARGE",
      "REFUND",
      "CASHBACK",
      "BOOKING_PAYMENT",
      "BOOKING_REFUND",
      "GARAGE_ACCEPT_FEE",
      "SOS_DEDUCTION",
    ])
    .withMessage("Invalid wallet transaction type"),
];

module.exports = {
  walletRechargeSchema,
  useWalletSchema,
  walletTransactionQuerySchema,
};
