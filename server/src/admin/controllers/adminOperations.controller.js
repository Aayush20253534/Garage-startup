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

module.exports = {
  getDashboardStats,
  listBookings,
  listCustomers,
  sendNotification,
};
