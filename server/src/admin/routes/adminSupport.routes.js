const express = require("express");

const controller = require("../controllers/adminSupport.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  listTicketValidation,
  replyTicketValidation,
  ticketIdParam,
  updateTicketValidation,
} = require("../validations/adminSupport.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/staff", controller.listStaff);
router.get("/", listTicketValidation, validate, controller.listTickets);
router.get("/:ticketId", ticketIdParam, validate, controller.getTicket);
router.patch(
  "/:ticketId",
  updateTicketValidation,
  validate,
  controller.updateTicket,
);
router.post(
  "/:ticketId/replies",
  replyTicketValidation,
  validate,
  controller.replyToTicket,
);

module.exports = router;
