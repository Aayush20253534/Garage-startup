const { body, param, query } = require("express-validator");

const notificationTypes = [
  "BOOKING",
  "PAYMENT",
  "WARRANTY",
  "PROMOTION",
  "SYSTEM",
  "SOS",
];

const bookingStatuses = [
  "PENDING_PAYMENT",
  "PENDING_VERIFICATION",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "EXPIRED",
];

const paymentRecordTypes = [
  "CUSTOMER_PLATFORM_FEE",
  "CUSTOMER_WALLET_RECHARGE",
  "CUSTOMER_WALLET_PAYMENT",
  "CUSTOMER_SOS_CHARGE",
  "GARAGE_WALLET_RECHARGE",
  "GARAGE_PLATFORM_FEE",
  "ADMIN_CUSTOMER_WALLET_CREDIT",
  "ADMIN_GARAGE_WALLET_CREDIT",
];

const paymentRecordStatuses = [
  "CREATED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PENDING",
  "SUCCESS",
];

const userRoles = ["CUSTOMER", "GARAGE_OWNER"];



const bookingIdParamSchema = [
  param("bookingId").isUUID().withMessage("Valid booking ID is required"),
];

const customerIdParamSchema = [
  param("userId").isUUID().withMessage("Valid customer ID is required"),
];

const deleteCustomersSchema = [
  body("customerIds")
    .isArray({ min: 1, max: 100 })
    .withMessage("Select between 1 and 100 customers"),
  body("customerIds.*")
    .isUUID()
    .withMessage("Every customer ID must be valid"),
];

const updateCustomerStatusSchema = [
  ...customerIdParamSchema,
  body("isActive")
    .isBoolean()
    .withMessage("Customer status must be true or false")
    .toBoolean(),
];

const updateBookingStatusSchema = [
  ...bookingIdParamSchema,
  body("status")
    .isIn(bookingStatuses)
    .withMessage("Select a valid booking status"),
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Note cannot exceed 1000 characters"),
];


const manualBookingOverrideSchema = [
  ...bookingIdParamSchema,
  body("reason")
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage("Override reason must be between 5 and 1000 characters"),
  body("scheduledDate").optional({ nullable: true }).isISO8601().withMessage("Scheduled date must be valid"),
  body("searchExpiresAt").optional({ nullable: true }).isISO8601().withMessage("Search expiry must be valid"),
  body("acceptedAt").optional({ nullable: true }).isISO8601().withMessage("Accepted date must be valid"),
  body("deliveredAt").optional({ nullable: true }).isISO8601().withMessage("Delivered date must be valid"),
  body("customerAcceptedAt").optional({ nullable: true }).isISO8601().withMessage("Customer acceptance date must be valid"),
  body("startTime").optional({ nullable: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("Start time must use HH:mm"),
  body("endTime").optional({ nullable: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("End time must use HH:mm"),
  body("customerAddress").optional({ nullable: true }).trim().isLength({ max: 500 }),
  body("customerLatitude").optional({ nullable: true }).isFloat({ min: -90, max: 90 }).toFloat(),
  body("customerLongitude").optional({ nullable: true }).isFloat({ min: -180, max: 180 }).toFloat(),
  body("handlingFee").optional().isInt({ min: 0, max: 1000000 }).toInt(),
  body("payableAmount").optional().isInt({ min: 0, max: 10000000 }).toInt(),
  body("totalServiceAmount").optional().isInt({ min: 0, max: 10000000 }).toInt(),
  body("totalServiceMaxAmount").optional().isInt({ min: 0, max: 10000000 }).toInt(),
  body("servicePrices").optional().isArray({ max: 100 }),
  body("servicePrices.*.bookingServiceId").optional().isUUID(),
  body("servicePrices.*.finalPrice").optional({ nullable: true }).isInt({ min: 0, max: 10000000 }).toInt(),
];

const reassignBookingGarageSchema = [
  ...bookingIdParamSchema,
  body("garageId").isUUID().withMessage("Select a valid garage"),
  body("note")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Note cannot exceed 1000 characters"),
];

const addBookingNoteSchema = [
  ...bookingIdParamSchema,
  body("note")
    .trim()
    .notEmpty()
    .withMessage("Note is required")
    .isLength({ max: 1000 })
    .withMessage("Note cannot exceed 1000 characters"),
];

const CLEAR_BOOKINGS_CONFIRMATION = "CLEAR ALL BOOKINGS";

const clearBookingsSchema = [
  body("confirmation")
    .isString()
    .withMessage("Confirmation is required")
    .custom((value) => value === CLEAR_BOOKINGS_CONFIRMATION)
    .withMessage(`Type ${CLEAR_BOOKINGS_CONFIRMATION} to continue`),
];

const customerQuerySchema = [
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  query("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  query("isActive")
    .optional({ nullable: true, checkFalsy: true })
    .isBoolean(),
];


const vehicleQuerySchema = [
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Search cannot exceed 120 characters"),
  query("verificationStatus")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(["VERIFIED", "UNVERIFIED", "MISSING"]),
  query("page")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100000 })
    .toInt(),
  query("limit")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .toInt(),
];

const bookingQuerySchema = [
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  query("status")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(bookingStatuses),

  query("garageId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID(),

  query("userId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID(),
];

const paymentQuerySchema = [
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 140 }),

  query("type")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(paymentRecordTypes),

  query("status")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(paymentRecordStatuses),

  query("from")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("From date must be a valid date"),

  query("to")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("To date must be a valid date"),

  query("limit")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 500 })
    .withMessage("Limit must be between 1 and 500"),
];

const walletRecipientQuerySchema = [
  query("type")
    .isIn(["CUSTOMER", "GARAGE_OWNER"])
    .withMessage("Recipient type must be CUSTOMER or GARAGE_OWNER"),
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Search cannot exceed 120 characters"),
];

const adminWalletTransferSchema = [
  body("recipientType")
    .isIn(["CUSTOMER", "GARAGE_OWNER"])
    .withMessage("Select a valid recipient type"),
  body("recipientId").isUUID().withMessage("Select a valid recipient"),
  body("amount")
    .isInt({ min: 1, max: 1000000 })
    .withMessage("Amount must be between Rs. 1 and Rs. 10,00,000"),
  body("note")
    .trim()
    .notEmpty()
    .withMessage("Transfer reason is required")
    .isLength({ min: 3, max: 300 })
    .withMessage("Transfer reason must be between 3 and 300 characters"),
  body("requestId").isUUID().withMessage("Valid transfer request ID is required"),
];

const sendNotificationSchema = [
  body("audience")
    .isIn(["ALL", "CITY", "USER"])
    .withMessage("Audience must be ALL, CITY, or USER"),

  body("userId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Valid user ID is required"),

  body("city")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 120 })
    .withMessage("Title cannot exceed 120 characters"),

  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 1000 })
    .withMessage("Message cannot exceed 1000 characters"),

  body("type")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(notificationTypes),

  body("link")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),
];

const userEmailSearchSchema = [
  query("search")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 120 }),

  query("role")
    .optional({ nullable: true, checkFalsy: true })
    .isIn(userRoles),
];

const sendUserEmailSchema = [
  body("userId")
    .isUUID()
    .withMessage("Select a valid user"),

  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Subject is required")
    .isLength({ max: 160 })
    .withMessage("Subject cannot exceed 160 characters"),

  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 5 })
    .withMessage("Message must be at least 5 characters")
    .isLength({ max: 5000 })
    .withMessage("Message cannot exceed 5000 characters"),
];

module.exports = {
  adminWalletTransferSchema,
  addBookingNoteSchema,
  bookingIdParamSchema,
  bookingQuerySchema,
  clearBookingsSchema,
  paymentQuerySchema,
  manualBookingOverrideSchema,
  customerIdParamSchema,
  customerQuerySchema,
  vehicleQuerySchema,
  deleteCustomersSchema,
  updateCustomerStatusSchema,
  reassignBookingGarageSchema,
  sendUserEmailSchema,
  sendNotificationSchema,
  updateBookingStatusSchema,
  userEmailSearchSchema,
  walletRecipientQuerySchema,
};
