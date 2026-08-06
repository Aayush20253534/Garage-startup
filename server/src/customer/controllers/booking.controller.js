const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const bookingService = require("../services/booking.service");

const createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking(req.user.id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, "Checkout booking created successfully", booking));
});


const getFirstBookingOffer = asyncHandler(async (req, res) => {
  const result = await bookingService.getFirstBookingOffer(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, "First-booking offer fetched", result));
});

const getBookingVerification = asyncHandler(async (req, res) => {
  const result = await bookingService.getBookingVerification(
    req.user.id,
    req.params.id,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "Booking verification fetched", result));
});

const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getMyBookings(req.user.id, req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, "Bookings fetched successfully", bookings));
});

const getPendingPaymentBookings = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getPendingPaymentBookings(req.user.id);

  return res.status(200).json(
    new ApiResponse(
      200,
      "Pending payment bookings fetched successfully",
      bookings,
    ),
  );
});

const getBookingById = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingById(req.user.id, req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Booking fetched successfully", booking));
});

const getBookingSuccess = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingSuccess(
    req.user.id,
    req.params.id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Booking success fetched successfully", booking));
});


const acceptDelivery = asyncHandler(async (req, res) => {
  const booking = await bookingService.acceptDelivery(
    req.user.id,
    req.params.id,
    req.body.finalAmount,
    req.body.paymentMethod,
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Final payment submitted for garage confirmation",
        booking,
      ),
    );
});

const regenerateHandoverOtp = asyncHandler(async (req, res) => {
  const result = await bookingService.regenerateHandoverOtp(
    req.user.id,
    req.params.id,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "New handover OTP generated successfully", result));
});

const getServiceHistory = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getServiceHistory(req.user.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Service history fetched successfully", bookings));
});
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking(req.user.id, req.params.id);

  return res
    .status(200)
    .json(new ApiResponse(200, "Booking cancelled successfully", booking));
});

module.exports = {
  createBooking,
  getFirstBookingOffer,
  getBookingVerification,
  getMyBookings,
  getPendingPaymentBookings,
  getBookingById,
  getBookingSuccess,
  acceptDelivery,
  regenerateHandoverOtp,
  getServiceHistory,
  cancelBooking,
};
