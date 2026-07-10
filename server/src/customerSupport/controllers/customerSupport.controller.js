const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/customerSupport.service");

const dashboard = asyncHandler(async (req, res) => {
  const result = await service.getDashboard(req.user.id);
  return res.status(200).json(new ApiResponse(200, "Support dashboard fetched", result));
});

const listTickets = asyncHandler(async (req, res) => {
  const result = await service.listTickets(req.query, req.user.id);
  return res.status(200).json(new ApiResponse(200, "Support tickets fetched", result));
});

const getTicket = asyncHandler(async (req, res) => {
  const result = await service.getTicket(req.params.ticketId, req.user.id);
  return res.status(200).json(new ApiResponse(200, "Support ticket fetched", result));
});

const claimTicket = asyncHandler(async (req, res) => {
  const result = await service.claimTicket(req.params.ticketId, req.user);
  return res.status(200).json(new ApiResponse(200, "Ticket claimed successfully", result));
});

const releaseTicket = asyncHandler(async (req, res) => {
  const result = await service.releaseTicket(req.params.ticketId, req.user.id);
  return res.status(200).json(new ApiResponse(200, "Ticket released successfully", result));
});

const replyToTicket = asyncHandler(async (req, res) => {
  const result = await service.replyToTicket({
    ticketId: req.params.ticketId,
    body: req.body.body,
    isInternal: req.body.isInternal,
    supportAccount: req.user,
  });
  return res.status(201).json(new ApiResponse(201, "Reply added successfully", result));
});

const updateTicket = asyncHandler(async (req, res) => {
  const result = await service.updateTicket({
    ticketId: req.params.ticketId,
    data: req.body,
    supportAccount: req.user,
  });
  return res.status(200).json(new ApiResponse(200, "Ticket updated successfully", result));
});

const listNotifications = asyncHandler(async (req, res) => {
  const result = await service.listNotifications(req.user.id);
  return res.status(200).json(new ApiResponse(200, "Notifications fetched", result));
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const result = await service.markNotificationRead(req.params.notificationId, req.user.id);
  return res.status(200).json(new ApiResponse(200, "Notification marked as read", result));
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await service.markAllNotificationsRead(req.user.id);
  return res.status(200).json(new ApiResponse(200, "Notifications marked as read", result));
});

const searchEmailUsers = asyncHandler(async (req, res) => {
  const result = await service.searchEmailUsers(req.query);
  return res.status(200).json(new ApiResponse(200, "Users fetched", result));
});

const sendCustomerNotification = asyncHandler(async (req, res) => {
  const result = await service.sendCustomerNotification(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, "Customer notification sent successfully", result));
});

const sendUserEmail = asyncHandler(async (req, res) => {
  const result = await service.sendUserEmail({
    supportAccount: req.user,
    payload: req.body,
  });
  return res.status(200).json(new ApiResponse(200, "Email sent successfully", result));
});

const listEmailLogs = asyncHandler(async (req, res) => {
  const result = await service.listEmailLogs(req.user.id);
  return res.status(200).json(new ApiResponse(200, "Email history fetched", result));
});

module.exports = {
  claimTicket,
  dashboard,
  getTicket,
  listEmailLogs,
  listNotifications,
  listTickets,
  markAllNotificationsRead,
  markNotificationRead,
  releaseTicket,
  replyToTicket,
  searchEmailUsers,
  sendCustomerNotification,
  sendUserEmail,
  updateTicket,
};
