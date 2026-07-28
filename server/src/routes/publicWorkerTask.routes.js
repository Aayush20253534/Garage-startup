const express = require("express");

const controller = require("../controllers/garageWorkerTask.controller");
const rateLimit = require("../middlewares/rateLimit.middleware");
const upload = require("../middlewares/upload.middleware");

const router = express.Router();

const readLimit = rateLimit({
  name: "public-worker-task-read",
  windowMs: 60 * 1000,
  max: 120,
  fallbackMax: 60,
  keyGenerator: (req) => `${req.ip}:${String(req.params.token || "").slice(0, 16)}`,
});
const mutationLimit = rateLimit({
  name: "public-worker-task-mutation",
  windowMs: 60 * 1000,
  max: 60,
  fallbackMax: 30,
  keyGenerator: (req) => `${req.ip}:${String(req.params.token || "").slice(0, 16)}`,
});
const evidenceLimit = rateLimit({
  name: "public-worker-task-evidence",
  windowMs: 15 * 60 * 1000,
  max: 12,
  fallbackMax: 6,
  keyGenerator: (req) => `${req.ip}:${String(req.params.token || "").slice(0, 16)}`,
});

const inspectionMediaUpload = upload.createDiskUpload({
  fileSize: 50 * 1024 * 1024,
  files: 16,
  fields: 20,
  allowedMimeTypes: [...upload.IMAGE_MIME_TYPES, ...upload.VIDEO_MIME_TYPES],
});
const inspectionMediaFields = inspectionMediaUpload.fields([
  { name: "images", maxCount: 15 },
  { name: "video", maxCount: 1 },
]);
const receiveEvidence = [
  evidenceLimit,
  inspectionMediaFields,
  upload.registerUploadCleanup,
  upload.validateUploadedFiles,
];

router.get("/:token", readLimit, controller.getPublicTask);
router.post("/:token/tracking/start", mutationLimit, controller.startTracking);
router.post("/:token/tracking/location", mutationLimit, controller.addTrackingPoint);
router.post("/:token/tracking/stop", mutationLimit, controller.stopTracking);
router.post(
  "/:token/handover/complete-journey",
  mutationLimit,
  controller.completeHandoverJourney,
);
router.post("/:token/handover", ...receiveEvidence, controller.verifyHandover);
router.post("/:token/delivery", ...receiveEvidence, controller.markDelivered);

module.exports = router;
