const { body, param, query } = require("express-validator");

const TYPES = ["SUPPORT", "DISPUTE"];
const CATEGORIES = [
  "GENERAL",
  "BOOKING",
  "PAYMENT",
  "GARAGE",
  "SERVICE",
  "WARRANTY",
  "ACCOUNT",
  "TECHNICAL",
  "OTHER",
];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
const STATUSES = ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const OUTCOMES = [
  "CUSTOMER_FAVORED",
  "GARAGE_FAVORED",
  "PARTIAL_REFUND",
  "NO_ACTION",
  "MUTUAL_AGREEMENT",
];

const ticketIdParam = [
  param("ticketId").isUUID().withMessage("Invalid support ticket ID"),
];

const listTicketValidation = [
  query("search").optional().trim().isLength({ max: 160 }),
  query("type").optional().isIn(TYPES).withMessage("Invalid ticket type"),
  query("category").optional().isIn(CATEGORIES).withMessage("Invalid category"),
  query("priority").optional().isIn(PRIORITIES).withMessage("Invalid priority"),
  query("status").optional().isIn(STATUSES).withMessage("Invalid status"),
  query("supportAssigneeId")
    .optional()
    .custom((value) => value === "unassigned" || /^[0-9a-f-]{36}$/i.test(value))
    .withMessage("Invalid assignee"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
];

const updateTicketValidation = [
  ...ticketIdParam,
  body("status").optional().isIn(STATUSES).withMessage("Invalid status"),
  body("priority").optional().isIn(PRIORITIES).withMessage("Invalid priority"),
  body("supportAssigneeId")
    .optional({ nullable: true })
    .custom((value) => value === null || value === "" || /^[0-9a-f-]{36}$/i.test(value))
    .withMessage("Invalid customer support account"),
  body("resolutionOutcome")
    .optional({ nullable: true })
    .custom((value) => value === null || value === "" || OUTCOMES.includes(value))
    .withMessage("Invalid resolution outcome"),
  body("resolutionNote").optional({ nullable: true }).trim().isLength({ max: 3000 }),
  body("refundAmount")
    .optional({ nullable: true })
    .custom((value) => value === null || value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0))
    .withMessage("Refund amount must be zero or greater"),
];

const replyTicketValidation = [
  ...ticketIdParam,
  body("body")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Reply must be between 1 and 5000 characters"),
  body("isInternal").optional().isBoolean().withMessage("Invalid internal note flag"),
];

module.exports = {
  listTicketValidation,
  replyTicketValidation,
  ticketIdParam,
  updateTicketValidation,
};
