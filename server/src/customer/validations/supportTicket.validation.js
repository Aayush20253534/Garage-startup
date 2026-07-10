const { body, param } = require("express-validator");

const TICKET_TYPES = ["SUPPORT", "DISPUTE"];
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

const ticketIdValidation = [
  param("ticketId").isUUID().withMessage("Invalid support ticket ID"),
];

const createTicketValidation = [
  body("type")
    .optional()
    .isIn(TICKET_TYPES)
    .withMessage("Invalid support ticket type"),
  body("category")
    .optional()
    .isIn(CATEGORIES)
    .withMessage("Invalid support category"),
  body("priority")
    .optional()
    .isIn(PRIORITIES)
    .withMessage("Invalid support priority"),
  body("bookingId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Invalid booking ID"),
  body("subject")
    .trim()
    .isLength({ min: 4, max: 160 })
    .withMessage("Subject must be between 4 and 160 characters"),
  body("description")
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Description must be between 10 and 5000 characters"),
];

const replyTicketValidation = [
  ...ticketIdValidation,
  body("body")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Reply must be between 1 and 5000 characters"),
];

module.exports = {
  createTicketValidation,
  replyTicketValidation,
  ticketIdValidation,
};
