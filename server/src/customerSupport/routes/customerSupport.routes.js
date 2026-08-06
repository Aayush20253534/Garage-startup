const express = require("express");

const controller = require("../controllers/customerSupport.controller");
const { protectCustomerSupport } = require("../../middlewares/auth.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const validate = require("../../middlewares/validate.middleware");
const rules = require("../validations/customerSupport.validation");

const router = express.Router();

const supportOutboundRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  fallbackMax: 5,
  keyGenerator: (req) => `support-outbound:${req.user?.id || req.ip}`,
});

router.use(protectCustomerSupport);

router.get("/push/public-key", controller.getPushPublicConfig);
router.post("/push/subscriptions", controller.subscribePush);
router.delete("/push/subscriptions", controller.unsubscribePush);

router.get("/dashboard", controller.dashboard);

router.get("/leads", rules.listLeads, validate, controller.listVerificationLeads);
router.get("/leads/:leadId", rules.leadId, validate, controller.getVerificationLead);
router.post("/leads/:leadId/claim", rules.leadId, validate, controller.claimVerificationLead);
router.post("/leads/:leadId/call", rules.leadId, validate, controller.startVerificationCall);
router.post("/leads/:leadId/approve", rules.leadDecision, validate, controller.approveVerificationLead);
router.post("/leads/:leadId/reject", rules.leadDecision, validate, controller.rejectVerificationLead);

router.get("/tickets", rules.listTickets, validate, controller.listTickets);
router.get("/tickets/:ticketId", rules.ticketId, validate, controller.getTicket);
router.post("/tickets/:ticketId/claim", rules.ticketId, validate, controller.claimTicket);
router.post("/tickets/:ticketId/release", rules.ticketId, validate, controller.releaseTicket);
router.post("/tickets/:ticketId/replies", rules.reply, validate, controller.replyToTicket);
router.patch("/tickets/:ticketId", rules.update, validate, controller.updateTicket);

router.post(
  "/notifications/send",
  supportOutboundRateLimit,
  rules.sendNotification,
  validate,
  controller.sendCustomerNotification,
);
router.get("/notify", controller.listNotifications);
router.patch("/notify/read-all", controller.markAllNotificationsRead);
router.patch(
  "/notify/:notificationId/read",
  rules.notificationId,
  validate,
  controller.markNotificationRead,
);

// Backward-compatible aliases for clients deployed before Notify was split
// from the customer-notification sending page.
router.get("/notifications", controller.listNotifications);
router.patch("/notifications/read-all", controller.markAllNotificationsRead);
router.patch(
  "/notifications/:notificationId/read",
  rules.notificationId,
  validate,
  controller.markNotificationRead,
);

router.get("/email-users", rules.emailSearch, validate, controller.searchEmailUsers);
router.post(
  "/emails",
  supportOutboundRateLimit,
  rules.sendEmail,
  validate,
  controller.sendUserEmail,
);
router.get("/emails/history", controller.listEmailLogs);

module.exports = router;
