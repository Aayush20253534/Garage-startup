const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/adminSupport.service");

const listTickets = asyncHandler(async (req, res) => {
  const result = await service.listTickets(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, "Support tickets fetched successfully", result));
});

const getTicket = asyncHandler(async (req, res) => {
  const ticket = await service.getTicket(req.params.ticketId);
  return res
    .status(200)
    .json(new ApiResponse(200, "Support ticket fetched successfully", ticket));
});

const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await service.updateTicket({
    ticketId: req.params.ticketId,
    data: req.body,
    staff: req.user,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Support ticket updated successfully", ticket));
});

const replyToTicket = asyncHandler(async (req, res) => {
  const ticket = await service.replyToTicket({
    ticketId: req.params.ticketId,
    body: req.body.body,
    isInternal: req.body.isInternal,
    staff: req.user,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, "Support reply added successfully", ticket));
});

const listStaff = asyncHandler(async (req, res) => {
  const staff = await service.listStaff();
  return res
    .status(200)
    .json(new ApiResponse(200, "Support staff fetched successfully", staff));
});

module.exports = {
  getTicket,
  listStaff,
  listTickets,
  replyToTicket,
  updateTicket,
};
