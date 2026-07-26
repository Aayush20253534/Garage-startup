const express = require("express");

const garageRequestController = require("../controllers/garageRequest.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const upload = require("../middlewares/upload.middleware");

const {
  acceptGarageRequestSchema,
  rejectGarageRequestSchema,
  verifyHandoverOtpSchema,
  markDeliveredSchema,
} = require("../validations/garageRequest.validation");

const router = express.Router();

const inspectionMediaUpload = upload.createDiskUpload({
  fileSize: 50 * 1024 * 1024,
  files: 16,
  fields: 20,
  allowedMimeTypes: [
    ...upload.IMAGE_MIME_TYPES,
    ...upload.VIDEO_MIME_TYPES,
  ],
});

const inspectionMediaFields = inspectionMediaUpload.fields([
  { name: "images", maxCount: 15 },
  { name: "video", maxCount: 1 },
]);

router.use(protect);
router.use(authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER"));

router.get("/", garageRequestController.getGarageRequests);
router.get("/:requestId", garageRequestController.getGarageRequestById);

router.post(
  "/:requestId/accept",
  acceptGarageRequestSchema,
  validate,
  garageRequestController.acceptGarageRequest
);


router.post(
  "/:requestId/verify-handover-otp",
  inspectionMediaFields,
  upload.registerUploadCleanup,
  upload.validateUploadedFiles,
  verifyHandoverOtpSchema,
  validate,
  garageRequestController.verifyHandoverOtp
);

router.post(
  "/:requestId/mark-delivered",
  inspectionMediaFields,
  upload.registerUploadCleanup,
  upload.validateUploadedFiles,
  markDeliveredSchema,
  validate,
  garageRequestController.markDelivered
);
router.post(
  "/:requestId/reject",
  rejectGarageRequestSchema,
  validate,
  garageRequestController.rejectGarageRequest
);

module.exports = router;
