const { body, query } = require("express-validator");

const notificationTypes = ["BOOKING", "PAYMENT", "WARRANTY", "PROMOTION", "SYSTEM", "SOS"];
const bookingStatuses = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "EXPIRED",
];
const userRoles = ["CUSTOMER", "GARAGE_OWNER", "ADMIN", "INTERN"];

const customerQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("city").optional({ nullable: true, checkFalsy: true }).trim(),
  query("isActive").optional({ nullable: true, checkFalsy: true }).isBoolean(),
];

const bookingQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("status").optional({ nullable: true, checkFalsy: true }).isIn(bookingStatuses),
  query("garageId").optional({ nullable: true, checkFalsy: true }).isUUID(),
  query("userId").optional({ nullable: true, checkFalsy: true }).isUUID(),
];

const sendNotificationSchema = [
  body("audience").isIn(["ALL", "CITY", "USER"]).withMessage("Audience must be ALL, CITY, or USER"),
  body("userId").optional({ nullable: true, checkFalsy: true }).isUUID().withMessage("Valid user ID is required"),
  body("city").optional({ nullable: true, checkFalsy: true }).trim(),
  body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 120 }).withMessage("Title cannot exceed 120 characters"),
  body("message").trim().notEmpty().withMessage("Message is required").isLength({ max: 1000 }).withMessage("Message cannot exceed 1000 characters"),
  body("type").optional({ nullable: true, checkFalsy: true }).isIn(notificationTypes),
  body("link").optional({ nullable: true, checkFalsy: true }).trim(),
];

const userEmailSearchSchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("role").optional({ nullable: true, checkFalsy: true }).isIn(userRoles),
];

const sendUserEmailSchema = [
  body("userId").isUUID().withMessage("Select a valid user"),
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
  bookingQuerySchema,
  customerQuerySchema,
  sendUserEmailSchema,
  sendNotificationSchema,
  userEmailSearchSchema,
};
