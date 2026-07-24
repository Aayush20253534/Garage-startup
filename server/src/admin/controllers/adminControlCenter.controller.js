const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const service = require("../services/adminControlCenter.service");

const send = (res, message, data, status = 200) => res.status(status).json(new ApiResponse(status, message, data));

const getOverview = asyncHandler(async (req, res) => send(res, "Admin control center overview fetched", await service.getOverview()));
const getAuditLogs = asyncHandler(async (req, res) => send(res, "Audit logs fetched", await service.getAuditLogs(req.query)));
const listSupportBookings = asyncHandler(async (req, res) => send(res, "Support bookings fetched", await service.listSupportBookings(req.query)));
const resendBookingNotification = asyncHandler(async (req, res) => send(res, "Booking notification sent", await service.resendBookingNotification({ bookingId: req.params.bookingId, ...req.body, staff: req.user })));
const listGaragePerformance = asyncHandler(async (req, res) => send(res, "Garage performance fetched", await service.listGaragePerformance(req.query)));
const setGarageOperationalStatus = asyncHandler(async (req, res) => send(res, "Garage operational status updated", await service.setGarageOperationalStatus({ garageId: req.params.garageId, ...req.body })));
const listEscalations = asyncHandler(async (req, res) => send(res, "Escalations fetched", await service.listEscalations(req.query)));
const updateEscalation = asyncHandler(async (req, res) => send(res, "Escalation updated", await service.updateEscalation({ id: req.params.id, ...req.body, staff: req.user })));
const listEscalationRules = asyncHandler(async (req, res) => send(res, "Escalation rules fetched", await service.listEscalationRules()));
const updateEscalationRule = asyncHandler(async (req, res) => send(res, "Escalation rule updated", await service.updateEscalationRule(req.params.id, req.body)));
const getPricingCoverage = asyncHandler(async (req, res) => send(res, "Pricing coverage fetched", await service.getPricingCoverage()));
const exportPriceRanges = asyncHandler(async (req, res) => {
  const csv = await service.exportPriceRangesCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rovauto-price-ranges-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.status(200).send(csv);
});
const importPriceRanges = asyncHandler(async (req, res) => send(res, req.body.dryRun ? "Price range import validated" : "Price ranges imported", await service.importPriceRanges(req.body)));
const listPriceSchedules = asyncHandler(async (req, res) => send(res, "Price schedules fetched", await service.listPriceSchedules(req.query)));
const createPriceSchedule = asyncHandler(async (req, res) => send(res, "Price schedule created", await service.createPriceSchedule(req.body, req.user), 201));
const cancelPriceSchedule = asyncHandler(async (req, res) => send(res, "Price schedule cancelled", await service.cancelPriceSchedule(req.params.id)));
const listAvailabilityRules = asyncHandler(async (req, res) => send(res, "Availability rules fetched", await service.listAvailabilityRules(req.query)));
const createAvailabilityRule = asyncHandler(async (req, res) => send(res, "Availability rule created", await service.createAvailabilityRule(req.body, req.user), 201));
const updateAvailabilityRule = asyncHandler(async (req, res) => send(res, "Availability rule updated", await service.updateAvailabilityRule(req.params.id, req.body, req.user)));
const deleteAvailabilityRule = asyncHandler(async (req, res) => send(res, "Availability rule deleted", await service.deleteAvailabilityRule(req.params.id)));

module.exports = {
  cancelPriceSchedule,
  createAvailabilityRule,
  createPriceSchedule,
  deleteAvailabilityRule,
  exportPriceRanges,
  getAuditLogs,
  getOverview,
  getPricingCoverage,
  importPriceRanges,
  listAvailabilityRules,
  listEscalationRules,
  listEscalations,
  listGaragePerformance,
  listPriceSchedules,
  listSupportBookings,
  resendBookingNotification,
  setGarageOperationalStatus,
  updateAvailabilityRule,
  updateEscalation,
  updateEscalationRule,
};
