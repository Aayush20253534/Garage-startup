const express = require("express");

const controller = require("../controllers/supportTicket.controller");
const upload = require("../../middlewares/upload.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  createTicketValidation,
  replyTicketValidation,
  ticketIdValidation,
} = require("../validations/supportTicket.validation");

const router = express.Router();

const supportTicketImageUpload = upload.createUpload({
  fileSize: 10 * 1024 * 1024,
  files: 5,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
});

router.get("/bookings", controller.listRecentBookings);
router.get("/my", controller.listMyTickets);
router.post(
  "/",
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
