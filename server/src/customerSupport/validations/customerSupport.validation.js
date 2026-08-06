const { body, param, query } = require("express-validator");

const TYPES = ["SUPPORT", "DISPUTE"];
const CATEGORIES = [
  "GENERAL", "BOOKING", "PAYMENT", "GARAGE", "SERVICE", "WARRANTY",
  "ACCOUNT", "TECHNICAL", "OTHER",
];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER", "RESOLVED"];

const ticketId = [param("ticketId").isUUID().withMessage("Invalid support ticket ID")];

const leadId = [param("leadId").isUUID().withMessage("Invalid verification lead ID")];

const listLeads = [
  query("status").optional().isIn(["PENDING", "CLAIMED", "IN_CALL", "APPROVED", "REJECTED"]),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const leadDecision = [
  ...leadId,
  body("notes").optional({ nullable: true }).trim().isLength({ max: 3000 }),
];

const notificationId = [
  param("notificationId").isUUID().withMessage("Invalid notification ID"),
];

const listTickets = [
  query("search").optional().trim().isLength({ max: 160 }),
  query("queue").optional().isIn(["AVAILABLE", "MINE", "UNASSIGNED", "ALL"]),
  query("type").optional().isIn(TYPES),
  query("category").optional().isIn(CATEGORIES),
  query("priority").optional().isIn(PRIORITIES),
  query("status").optional().isIn([...STATUSES, "CLOSED"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const reply = [
  ...ticketId,
  body("body").trim().isLength({ min: 1, max: 5000 }),
  body("isInternal").optional().isBoolean(),
];

const update = [
  ...ticketId,
  body("status").optional().isIn(STATUSES),
  body("priority").optional().isIn(PRIORITIES),
  body("resolutionNote").optional({ nullable: true }).trim().isLength({ max: 3000 }),
];

const emailSearch = [
  query("search").optional().trim().isLength({ max: 160 }),
  query("role").optional().isIn(["CUSTOMER", "GARAGE_OWNER"]),
];

const sendEmail = [
  body("userId").isUUID().withMessage("Invalid user ID"),
  body("subject").trim().isLength({ min: 1, max: 300 }),
  body("message").trim().isLength({ min: 1, max: 10000 }),
];

const sendNotification = [
  body("audience").isIn(["ALL", "CITY", "USER"]),
  body("userId")
    .if(body("audience").equals("USER"))
    .isUUID()
    .withMessage("A valid customer is required"),
  body("city")
    .if(body("audience").equals("CITY"))
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("City is required"),
  body("title").trim().isLength({ min: 1, max: 160 }),
  body("message").trim().isLength({ min: 1, max: 1000 }),
  body("type")
    .optional()
    .isIn(["SYSTEM", "PROMOTION", "BOOKING", "PAYMENT", "WARRANTY", "SOS"]),
  body("link").optional({ nullable: true }).trim().isLength({ max: 500 }),
];

module.exports = {
  emailSearch,
  leadDecision,
  leadId,
  listLeads,
  listTickets,
  notificationId,
  reply,
  sendEmail,
  sendNotification,
  ticketId,
  update,
};
