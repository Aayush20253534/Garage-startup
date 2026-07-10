const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/supportTicket.service");

const createTicket = asyncHandler(async (req, res) => {
  const ticket = await service.createTicket({
    user: req.user,
    data: req.body,
    files: req.files || [],
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Support ticket created successfully", ticket));
});

const listMyTickets = asyncHandler(async (req, res) => {
  const tickets = await service.listMyTickets(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, "Support tickets fetched successfully", tickets));
});

const getMyTicket = asyncHandler(async (req, res) => {
  const ticket = await service.getMyTicket(req.user.id, req.params.ticketId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Support ticket fetched successfully", ticket));
});

const replyToTicket = asyncHandler(async (req, res) => {
  const ticket = await service.replyToTicket({
    user: req.user,
    ticketId: req.params.ticketId,
    body: req.body.body,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Reply sent successfully", ticket));
});

const closeTicket = asyncHandler(async (req, res) => {
  const ticket = await service.closeTicket({
    userId: req.user.id,
    ticketId: req.params.ticketId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Support ticket closed successfully", ticket));
});

const listRecentBookings = asyncHandler(async (req, res) => {
  const bookings = await service.listRecentBookings(req.user.id);
  return res
    .status(200)
    .json(new ApiResponse(200, "Bookings fetched successfully", bookings));
});

module.exports = {
  closeTicket,
  createTicket,
  getMyTicket,
  listMyTickets,
  listRecentBookings,
  replyToTicket,
};
