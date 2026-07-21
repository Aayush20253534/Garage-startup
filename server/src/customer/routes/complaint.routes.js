const express = require("express");

const complaintController = require("../controllers/complaint.controller");
const { protect } = require("../../middlewares/auth.middleware");
const createKeyedConcurrencyLimit = require("../../middlewares/keyedConcurrencyLimit.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");
const {
  COMPLAINT_MAX_FILES,
  COMPLAINT_MAX_FILE_SIZE_BYTES,
} = require("../constants/complaintUpload");

const {
  complaintIdValidation,
  createComplaintValidation,
  listComplaintsValidation,
} = require("../validations/complaint.validation");

const router = express.Router();

const complaintImageUpload = upload.createDiskUpload({
  fileSize: COMPLAINT_MAX_FILE_SIZE_BYTES,
  files: COMPLAINT_MAX_FILES,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
});

const complaintCreateRateLimit = rateLimit({
  name: "complaint-create",
  windowMs: 15 * 60 * 1000,
  max: 3,
  fallbackMax: 2,
  keyGenerator: (req) => `${req.user?.id || "customer"}:${req.ip}`,
  message: "Too many complaints submitted. Please try again later.",
});

const complaintCreateConcurrencyLimit = createKeyedConcurrencyLimit({
  name: "complaint upload",
  maxGlobal: process.env.COMPLAINT_UPLOAD_MAX_CONCURRENCY || 4,
  maxPerKey: 1,
  keyGenerator: (req) => req.user?.id || req.ip,
});

router.use(protect);

router.post(
  "/",
  complaintCreateRateLimit,
  complaintCreateConcurrencyLimit,
  upload.registerUploadCleanup,
  complaintImageUpload.array("images", COMPLAINT_MAX_FILES),
  upload.validateUploadedFiles,
  createComplaintValidation,
  validate,
  complaintController.createComplaint
);

router.get("/my", listComplaintsValidation, validate, complaintController.getMyComplaints);

router.get(
  "/:id",
  complaintIdValidation,
  validate,
  complaintController.getComplaintById
);

module.exports = router;
