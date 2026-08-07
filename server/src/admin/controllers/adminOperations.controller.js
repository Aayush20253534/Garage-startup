const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/adminOperations.service");

const listCustomers = asyncHandler(async (req, res) => {
  const customers = await service.listCustomers(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Customers fetched successfully", customers));
});


const listVehicles = asyncHandler(async (req, res) => {
  const vehicles = await service.listVehicles(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicles fetched successfully", vehicles));
});

const lookupVehicleRegistration = asyncHandler(async (req, res) => {
  const result = await service.lookupVehicleRegistration(
    req.query.registrationNumber,
  );
  return res
    .status(200)
    .json(new ApiResponse(200, "Vehicle registration found", result));
});

const deleteCustomers = asyncHandler(async (req, res) => {
  const result = await service.deleteCustomers({
    customerIds: req.body.customerIds,
    requestedById: req.user.id,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Customers deleted successfully", result));
});

const setCustomerActiveStatus = asyncHandler(async (req, res) => {
  const customer = await service.setCustomerActiveStatus({
    userId: req.params.userId,
    isActive: req.body.isActive,
    requestedById: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      customer.isActive
        ? "Customer unblocked successfully"
        : "Customer blocked successfully",
      customer,
    ),
  );
});

const listBookings = asyncHandler(async (req, res) => {
  const bookings = await service.listBookings(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Bookings fetched successfully", bookings));
});


const getOperationsDashboard = asyncHandler(async (req, res) => {
  const result = await service.getOperationsDashboard();
  return res
    .status(200)
    .json(new ApiResponse(200, "Live operations fetched successfully", result));
});

const getBookingDetails = asyncHandler(async (req, res) => {
  const booking = await service.getBookingDetails(req.params.bookingId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Booking details fetched successfully", booking));
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const booking = await service.updateBookingStatus({
    bookingId: req.params.bookingId,
    status: req.body.status,
    note: req.body.note,
    staff: req.user,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Booking status updated successfully", booking));
});

const reassignBookingGarage = asyncHandler(async (req, res) => {
  const booking = await service.reassignBookingGarage({
    bookingId: req.params.bookingId,
    garageId: req.body.garageId,
    note: req.body.note,
    staff: req.user,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Booking garage updated successfully", booking));
});


const manualOverrideBooking = asyncHandler(async (req, res) => {
  const booking = await service.manualOverrideBooking({
    bookingId: req.params.bookingId,
    payload: req.body,
    staff: req.user,
  });
  return res.status(200).json(
    new ApiResponse(200, "Booking override saved successfully", booking),
  );
});

const addBookingAdminNote = asyncHandler(async (req, res) => {
  const booking = await service.addBookingAdminNote({
    bookingId: req.params.bookingId,
    note: req.body.note,
    staff: req.user,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, "Internal note added successfully", booking));
});

const getCustomerProfile = asyncHandler(async (req, res) => {
  const customer = await service.getCustomerProfile(req.params.userId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Customer profile fetched successfully", customer));
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

const searchWalletTransferRecipients = asyncHandler(async (req, res) => {
  const recipients = await service.searchWalletTransferRecipients(req.query);
  return res.status(200).json(
    new ApiResponse(200, "Wallet recipients fetched successfully", recipients),
  );
});

const transferWalletFunds = asyncHandler(async (req, res) => {
  const result = await service.transferWalletFunds({
    ...req.body,
    amount: Number(req.body.amount),
    staff: req.user,
  });
  return res.status(201).json(
    new ApiResponse(201, "Wallet funds transferred successfully", result),
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
  addBookingAdminNote,
  clearAllBookings,
  deleteCustomers,
  setCustomerActiveStatus,
  getBookingDetails,
  getCustomerProfile,
  getDashboardStats,
  getOperationsDashboard,
  listBookings,
  listCustomers,
  listVehicles,
  lookupVehicleRegistration,
  listPayments,
  manualOverrideBooking,
  searchWalletTransferRecipients,
  reassignBookingGarage,
  searchEmailUsers,
  sendUserEmail,
  sendNotification,
  updateBookingStatus,
  transferWalletFunds,
};
