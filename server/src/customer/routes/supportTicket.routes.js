const express = require("express");

const controller = require("../controllers/supportTicket.controller");
const createKeyedConcurrencyLimit = require("../../middlewares/keyedConcurrencyLimit.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const upload = require("../../middlewares/upload.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  createTicketValidation,
  listTicketsValidation,
  replyTicketValidation,
  ticketIdValidation,
} = require("../validations/supportTicket.validation");

const router = express.Router();

const supportTicketImageUpload = upload.createDiskUpload({
  fileSize: 5 * 1024 * 1024,
  files: 5,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
});

const supportTicketCreateRateLimit = rateLimit({
  name: "support-ticket-create",
  windowMs: 15 * 60 * 1000,
  max: 5,
  fallbackMax: 2,
  keyGenerator: (req) => `${req.user?.id || "customer"}:${req.ip}`,
  message: "Too many support tickets submitted. Please try again later.",
});

const supportTicketCreateConcurrencyLimit = createKeyedConcurrencyLimit({
  name: "support ticket upload",
  maxGlobal: process.env.SUPPORT_TICKET_UPLOAD_MAX_CONCURRENCY || 4,
  maxPerKey: 1,
  keyGenerator: (req) => req.user?.id || req.ip,
});

router.get("/bookings", controller.listRecentBookings);
router.get("/my", listTicketsValidation, validate, controller.listMyTickets);
router.post(
  "/",
  supportTicketCreateRateLimit,
  supportTicketCreateConcurrencyLimit,
  upload.registerUploadCleanup,
  supportTicketImageUpload.array("images", 5),
  upload.validateUploadedFiles,
  createTicketValidation,
  validate,
  controller.createTicket,
);
router.get("/:ticketId", ticketIdValidation, validate, controller.getMyTicket);
router.post(
  "/:ticketId/replies",
  replyTicketValidation,
  validate,
  controller.replyToTicket,
);
router.patch(
  "/:ticketId/close",
  ticketIdValidation,
  validate,
  controller.closeTicket,
);

module.exports = router;
