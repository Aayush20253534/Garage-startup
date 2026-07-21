const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/apiResponse");
const complaintService = require("../services/complaint.service");

const createComplaint = asyncHandler(async (req, res) => {
  const complaint = await complaintService.createComplaint(
    req.user.id,
    req.body,
    req.files
  );

  return res
    .status(201)
    .json(new ApiResponse(201, "Complaint created successfully", complaint));
});

const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await complaintService.getMyComplaints(req.user.id, req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, "Complaints fetched successfully", complaints));
});

const getComplaintById = asyncHandler(async (req, res) => {
  const complaint = await complaintService.getComplaintById(
    req.user.id,
    req.params.id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, "Complaint fetched successfully", complaint));
});

module.exports = {
  createComplaint,
  getMyComplaints,
  getComplaintById,
};
