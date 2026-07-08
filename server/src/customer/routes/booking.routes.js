const express = require("express");

const bookingController = require("../controllers/booking.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");

const {
  bookingIdValidation,
  createBookingValidation,
  acceptDeliveryValidation,
} = require("../validations/booking.validation");

const router = express.Router();

router.use(protect);

/**
 * Customer booking routes
 *
 * POST /api/bookings/checkout
 * Customer selects multiple services and creates booking.
 */
router.post(
  "/checkout",
  createBookingValidation,
  validate,
  bookingController.createBooking
);

/**
 * GET /api/bookings
 * Get logged-in customer's bookings.
 */
router.get("/service-history", bookingController.getServiceHistory);

router.get("/", bookingController.getMyBookings);

/**
 * GET /api/bookings/pending-payment
 * Get logged-in customer's retryable pending payment bookings.
 */
router.get(
  "/pending-payment",
  bookingController.getPendingPaymentBookings,
);

/**
 * GET /api/bookings/:id/success
 * Show success only after garage is assigned/confirmed.
 */
router.get(
  "/:id/success",
  bookingIdValidation,
  validate,
  bookingController.getBookingSuccess
);

/**
 * GET /api/bookings/:id
 * Booking details.
 */
router.get(
  "/:id",
  bookingIdValidation,
  validate,
  bookingController.getBookingById
);


router.post(
  "/:id/accept-delivery",
  acceptDeliveryValidation,
  validate,
  bookingController.acceptDelivery
);

router.post(
  "/:id/handover-otp/regenerate",
  bookingIdValidation,
  validate,
  bookingController.regenerateHandoverOtp
);
/**
 * PATCH /api/bookings/:id/cancel
 * Cancel booking.
 */
router.patch(
  "/:id/cancel",
  bookingIdValidation,
  validate,
  bookingController.cancelBooking
);

module.exports = router;
