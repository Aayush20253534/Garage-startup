const express = require("express");

const controller = require("../controllers/customerSupport.controller");
const { protectCustomerSupport } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const rules = require("../validations/customerSupport.validation");

const router = express.Router();
router.use(protectCustomerSupport);

router.get("/dashboard", controller.dashboard);
router.get("/tickets", rules.listTickets, validate, controller.listTickets);
router.get("/tickets/:ticketId", rules.ticketId, validate, controller.getTicket);
router.post("/tickets/:ticketId/claim", rules.ticketId, validate, controller.claimTicket);
router.post("/tickets/:ticketId/release", rules.ticketId, validate, controller.releaseTicket);
router.post("/tickets/:ticketId/replies", rules.reply, validate, controller.replyToTicket);
router.patch("/tickets/:ticketId", rules.update, validate, controller.updateTicket);

router.post(
  "/notifications/send",
  rules.sendNotification,
  validate,
  controller.sendCustomerNotification,
);
router.get("/notifications", controller.listNotifications);
router.patch("/notifications/read-all", controller.markAllNotificationsRead);
router.patch(
  "/notifications/:notificationId/read",
  rules.notificationId,
  validate,
  controller.markNotificationRead,
);

router.get("/email-users", rules.emailSearch, validate, controller.searchEmailUsers);
router.post("/emails", rules.sendEmail, validate, controller.sendUserEmail);
router.get("/emails/history", controller.listEmailLogs);

module.exports = router;
