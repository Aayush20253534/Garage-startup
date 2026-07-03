const express = require("express");

const controller = require("../controllers/adminOperations.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  bookingQuerySchema,
  customerQuerySchema,
  sendNotificationSchema,
} = require("../validations/adminOperations.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/stats", controller.getDashboardStats);
router.get(
  "/customers",
  customerQuerySchema,
  validate,
  controller.listCustomers,
);
router.get("/bookings", bookingQuerySchema, validate, controller.listBookings);
router.post(
  "/notifications",
  sendNotificationSchema,
  validate,
  controller.sendNotification,
);

module.exports = router;
