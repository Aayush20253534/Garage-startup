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
  bookingStageMutationSchema,
  serviceHistoryQuerySchema,
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
router.get(
  "/service-history",
  serviceHistoryQuerySchema,
  validate,
  garageRequestController.getGarageServiceHistory,
);
router.get("/:requestId", garageRequestController.getGarageRequestById);

router.post(
  "/:requestId/accept",
  acceptGarageRequestSchema,
  validate,
  garageRequestController.acceptGarageRequest
);


router.post(
  "/:requestId/verify-handover-otp",
  upload.registerUploadCleanup,
  inspectionMediaFields,
  upload.validateUploadedFiles,
  verifyHandoverOtpSchema,
  validate,
  garageRequestController.verifyHandoverOtp
);


router.post(
  "/:requestId/confirm-self-drop-arrival",
  upload.registerUploadCleanup,
  inspectionMediaFields,
  upload.validateUploadedFiles,
  markDeliveredSchema,
  validate,
  garageRequestController.confirmSelfDropArrival,
);

router.post(
  "/:requestId/mark-arrived-garage",
  bookingStageMutationSchema,
  validate,
  garageRequestController.markArrivedAtGarage,
);

router.post(
  "/:requestId/mark-service-complete",
  upload.registerUploadCleanup,
  inspectionMediaFields,
  upload.validateUploadedFiles,
  markDeliveredSchema,
  validate,
  garageRequestController.markServiceCompleted,
);

router.post(
  "/:requestId/mark-arrived-customer",
  bookingStageMutationSchema,
  validate,
  garageRequestController.markArrivedAtCustomer,
);

router.post(
  "/:requestId/confirm-final-payment",
  bookingStageMutationSchema,
  validate,
  garageRequestController.confirmFinalPayment,
);

router.post(
  "/:requestId/mark-delivered",
  upload.registerUploadCleanup,
  inspectionMediaFields,
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
