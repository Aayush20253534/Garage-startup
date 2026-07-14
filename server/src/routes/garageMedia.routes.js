const express = require("express");

const upload = require("../middlewares/upload.middleware");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const garageMediaController = require("../controllers/garageMedia.controller");

const router = express.Router();

const garagePhotoUpload = upload.createUpload({
  fileSize: 1024 * 1024,
  files: 15,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
});

router.get("/media/:imageId", garageMediaController.getGarageImageContent);

router.delete(
  "/:garageId/media/:imageId",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageMediaController.deleteGarageImage,
);

router.post(
  "/:garageId/media",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garagePhotoUpload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "images", maxCount: 14 },
  ]),
  upload.validateUploadedFiles,
  garageMediaController.uploadGarageMedia,
);

module.exports = router;
