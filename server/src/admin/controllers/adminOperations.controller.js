const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/adminOperations.service");

const listCustomers = asyncHandler(async (req, res) => {
  const customers = await service.listCustomers(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Customers fetched successfully", customers));
});

const listBookings = asyncHandler(async (req, res) => {
  const bookings = await service.listBookings(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Bookings fetched successfully", bookings));
});

const listPayments = asyncHandler(async (req, res) => {
  const payments = await service.listPayments(req.query);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Payment records fetched successfully",
        payments,
      ),
    );
});

const clearAllBookings = asyncHandler(async (req, res) => {
  const result = await service.clearAllBookings({
    confirmation: req.body.confirmation,
    requestedById: req.user.id,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "All bookings cleared successfully",
        result,
      ),
    );
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const result = await service.getDashboardStats();
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        "Admin dashboard stats fetched successfully",
        result,
      ),
    );
});

const sendNotification = asyncHandler(async (req, res) => {
  const result = await service.sendNotification(req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, "Notification sent successfully", result));
});

const searchEmailUsers = asyncHandler(async (req, res) => {
  const users = await service.searchEmailUsers(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Users fetched successfully", users));
});

const sendUserEmail = asyncHandler(async (req, res) => {
  const result = await service.sendUserEmail(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Email sent successfully", result));
});

module.exports = {
  clearAllBookings,
  getDashboardStats,
  listBookings,
  listCustomers,
  listPayments,
  searchEmailUsers,
  sendUserEmail,
  sendNotification,
};
