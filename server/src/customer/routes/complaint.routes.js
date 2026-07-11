const express = require("express");

const complaintController = require("../controllers/complaint.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");

const {
  complaintIdValidation,
  createComplaintValidation,
} = require("../validations/complaint.validation");

const router = express.Router();

const complaintImageUpload = upload.createUpload({
  fileSize: 10 * 1024 * 1024,
  files: 10,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
});

router.use(protect);

router.post(
  "/",
  complaintImageUpload.array("images", 10),
  upload.validateUploadedFiles,
  createComplaintValidation,
  validate,
  complaintController.createComplaint
);

router.get("/my", complaintController.getMyComplaints);

router.get(
  "/:id",
  complaintIdValidation,
  validate,
  complaintController.getComplaintById
);

module.exports = router;
