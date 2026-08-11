const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/homepageBanner.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const upload = require("../../middlewares/upload.middleware");
const validate = require("../../middlewares/validate.middleware");

const router = express.Router();
const bannerUpload = upload.createUpload({
  fileSize: 8 * 1024 * 1024,
  files: 1,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
}).single("image");
const bannerId = param("bannerId").isUUID().withMessage("Invalid banner ID");

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN"));
router.get("/", controller.listBanners);
router.post(
  "/",
  bannerUpload,
  upload.validateUploadedFiles,
  body("title").trim().isLength({ min: 1, max: 100 }).withMessage("Title must be 1–100 characters"),
  body("heading").trim().isLength({ min: 1, max: 140 }).withMessage("Public heading must be 1–140 characters"),
  body("description").trim().isLength({ min: 1, max: 400 }).withMessage("Public description must be 1–400 characters"),
  validate,
  controller.createBanner,
);
router.patch(
  "/settings",
  body("duration").isInt({ min: 1, max: 300 }).withMessage("Duration must be 1–300 seconds"),
  validate,
  controller.updateDuration,
);
router.put(
  "/order",
  body("bannerIds").isArray({ max: 100 }).withMessage("bannerIds must be an array"),
  body("bannerIds.*").isUUID().withMessage("Every banner ID must be valid"),
  validate,
  controller.reorderBanners,
);
router.patch(
  "/:bannerId",
  bannerId,
  body("title").optional().trim().isLength({ min: 1, max: 100 }),
  body("heading").optional().trim().isLength({ min: 1, max: 140 }),
  body("description").optional().trim().isLength({ min: 1, max: 400 }),
  body("isActive").optional().isBoolean().toBoolean(),
  validate,
  controller.updateBanner,
);
router.delete("/:bannerId", bannerId, validate, controller.deleteBanner);

module.exports = router;
