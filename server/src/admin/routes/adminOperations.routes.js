const express = require("express");

const controller = require("../controllers/adminOperations.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  addBookingNoteSchema,
  bookingIdParamSchema,
  bookingQuerySchema,
  clearBookingsSchema,
  customerIdParamSchema,
  customerQuerySchema,
  paymentQuerySchema,
  reassignBookingGarageSchema,
  sendNotificationSchema,
  sendUserEmailSchema,
  updateBookingStatusSchema,
  userEmailSearchSchema,
} = require("../validations/adminOperations.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/stats", controller.getDashboardStats);
router.get("/operations", controller.getOperationsDashboard);

router.get(
  "/customers",
  customerQuerySchema,
  validate,
  controller.listCustomers,
);
router.get(
  "/customers/:userId/profile",
  customerIdParamSchema,
  validate,
  controller.getCustomerProfile,
);

router.get("/bookings", bookingQuerySchema, validate, controller.listBookings);
router.get(
  "/bookings/:bookingId",
  bookingIdParamSchema,
  validate,
  controller.getBookingDetails,
);
router.patch(
  "/bookings/:bookingId/status",
  authorizeRoles("ADMIN"),
  updateBookingStatusSchema,
  validate,
  controller.updateBookingStatus,
);
router.patch(
  "/bookings/:bookingId/garage",
  authorizeRoles("ADMIN"),
  reassignBookingGarageSchema,
  validate,
  controller.reassignBookingGarage,
);
router.post(
  "/bookings/:bookingId/notes",
  authorizeRoles("ADMIN"),
  addBookingNoteSchema,
  validate,
  controller.addBookingAdminNote,
);
router.delete(
  "/bookings/all",
  authorizeRoles("ADMIN"),
  clearBookingsSchema,
  validate,
  controller.clearAllBookings,
);

router.get(
  "/payments",
  authorizeRoles("ADMIN"),
  paymentQuerySchema,
  validate,
  controller.listPayments,
);
router.get(
  "/email-users",
  userEmailSearchSchema,
  validate,
  controller.searchEmailUsers,
);
router.post(
  "/emails",
  sendUserEmailSchema,
  validate,
  controller.sendUserEmail,
);
router.post(
  "/notifications",
  sendNotificationSchema,
  validate,
  controller.sendNotification,
);

module.exports = router;
