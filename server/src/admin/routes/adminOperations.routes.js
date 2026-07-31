const express = require("express");

const controller = require("../controllers/adminOperations.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  adminWalletTransferSchema,
  addBookingNoteSchema,
  bookingIdParamSchema,
  bookingQuerySchema,
  clearBookingsSchema,
  customerIdParamSchema,
  customerQuerySchema,
  deleteCustomersSchema,
  updateCustomerStatusSchema,
  paymentQuerySchema,
  manualBookingOverrideSchema,
  reassignBookingGarageSchema,
  updateBookingStatusSchema,
  walletRecipientQuerySchema,
} = require("../validations/adminOperations.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN", "INTERN"));

router.get("/stats", controller.getDashboardStats);
router.get("/operations", controller.getOperationsDashboard);

router.get(
  "/customers",
  customerQuerySchema,
  validate,
  controller.listCustomers,
);
router.delete(
  "/customers",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  deleteCustomersSchema,
  validate,
  controller.deleteCustomers,
);
router.patch(
  "/customers/:userId/status",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  updateCustomerStatusSchema,
  validate,
  controller.setCustomerActiveStatus,
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
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  updateBookingStatusSchema,
  validate,
  controller.updateBookingStatus,
);
router.patch(
  "/bookings/:bookingId/garage",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  reassignBookingGarageSchema,
  validate,
  controller.reassignBookingGarage,
);
router.patch(
  "/bookings/:bookingId/manual-override",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  manualBookingOverrideSchema,
  validate,
  controller.manualOverrideBooking,
);

router.post(
  "/bookings/:bookingId/notes",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
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
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  paymentQuerySchema,
  validate,
  controller.listPayments,
);
router.get(
  "/wallet-transfers/recipients",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  walletRecipientQuerySchema,
  validate,
  controller.searchWalletTransferRecipients,
);
router.post(
  "/wallet-transfers",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  adminWalletTransferSchema,
  validate,
  controller.transferWalletFunds,
);
module.exports = router;
