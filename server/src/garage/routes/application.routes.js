const express = require("express");

const applicationController = require("../controllers/application.controller");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const {
  geocodeGarageApplicationSchema,
  submitGarageApplicationSchema,
} = require("../validations/application.validation");

const router = express.Router();

const geocodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `garage-application-geocode:${req.ip}`,
});

const submitApplicationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  fallbackMax: 1,
  keyGenerator: (req) => `garage-application-submit:${req.ip}`,
});

const applicationImageUpload = upload.createUpload({
  fileSize: 2 * 1024 * 1024,
  files: 15,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
});

router.get(
  "/geocode",
  geocodeRateLimit,
  geocodeGarageApplicationSchema,
  validate,
  applicationController.geocodeApplicationLocation
);

router.post(
  "/",
  submitApplicationRateLimit,
  applicationImageUpload.array("images", 15),
  upload.validateUploadedFiles,
  submitGarageApplicationSchema,
  validate,
  applicationController.submitApplication
);

module.exports = router;
