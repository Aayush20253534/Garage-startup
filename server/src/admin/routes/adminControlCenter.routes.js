const express = require("express");
const { param, query, body } = require("express-validator");
const controller = require("../controllers/adminControlCenter.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");

const router = express.Router();
router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN"));

const uuidParam = (name = "id") => param(name).isUUID().withMessage(`${name} must be a valid id`);

router.get("/overview", controller.getOverview);
router.get("/audit-logs", query("limit").optional().isInt({ min: 1, max: 300 }).toInt(), validate, controller.getAuditLogs);
router.get("/support-bookings", query("search").trim().isLength({ min: 1, max: 100 }), validate, controller.listSupportBookings);
router.post(
  "/support-bookings/:bookingId/notify",
  uuidParam("bookingId"),
  body("target").optional().isIn(["CUSTOMER", "GARAGE", "BOTH"]),
  body("message").optional().isString().isLength({ max: 500 }),
  validate,
  controller.resendBookingNotification,
);

router.get("/garages/performance", query("days").optional().isInt({ min: 1, max: 365 }).toInt(), validate, controller.listGaragePerformance);
router.patch(
  "/garages/:garageId/operational-status",
  uuidParam("garageId"),
  body("status").isIn(["ACTIVE", "TEMPORARILY_SUSPENDED", "PERMANENTLY_BLOCKED", "UNDER_REVIEW", "DOCUMENTS_EXPIRED"]),
  body("reason").optional().isString().isLength({ max: 1000 }),
  body("suspendedUntil").optional({ nullable: true }).isISO8601(),
  validate,
  controller.setGarageOperationalStatus,
);

router.get("/escalations", controller.listEscalations);
router.patch("/escalations/:id", uuidParam(), body("status").isIn(["OPEN", "ACKNOWLEDGED", "RESOLVED"]), body("note").optional().isString().isLength({ max: 1000 }), validate, controller.updateEscalation);
router.get("/escalation-rules", controller.listEscalationRules);
router.patch("/escalation-rules/:id", uuidParam(), body("thresholdMinutes").optional().isInt({ min: 1, max: 10080 }).toInt(), body("severity").optional().isIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), body("enabled").optional().isBoolean().toBoolean(), validate, controller.updateEscalationRule);

router.get("/pricing/coverage", controller.getPricingCoverage);
router.get("/pricing/export", controller.exportPriceRanges);
router.post("/pricing/import", body("rows").isArray({ min: 1, max: 2000 }), body("dryRun").optional().isBoolean().toBoolean(), validate, controller.importPriceRanges);
router.get("/pricing/schedules", controller.listPriceSchedules);
router.post("/pricing/schedules", controller.createPriceSchedule);
router.patch("/pricing/schedules/:id/cancel", uuidParam(), validate, controller.cancelPriceSchedule);

router.get("/availability-rules", controller.listAvailabilityRules);
router.post("/availability-rules", controller.createAvailabilityRule);
router.patch("/availability-rules/:id", uuidParam(), validate, controller.updateAvailabilityRule);
router.delete("/availability-rules/:id", uuidParam(), validate, controller.deleteAvailabilityRule);

module.exports = router;
