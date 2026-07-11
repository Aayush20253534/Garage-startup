const express = require("express");

const controller = require("../controllers/serviceAdmin.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const upload = require("../../middlewares/upload.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  categoryIdSchema,
  categoryQuerySchema,
  createCategorySchema,
  createServiceSchema,
  serviceIdSchema,
  updateCategorySchema,
  updateServiceSchema,
} = require("../validations/serviceAdmin.validation");

const router = express.Router();
const thumbnailUpload = upload.createUpload({
  fileSize: 2 * 1024 * 1024,
  files: 1,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
}).single("thumbnail");

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

// Interns may inspect the catalogue but only admins can mutate categories,
// services, or media. Pricing is managed through city service price ranges.
router.get("/categories", categoryQuerySchema, validate, controller.listCategories);
router.post(
  "/categories",
  authorizeRoles("ADMIN"),
  createCategorySchema,
  validate,
  controller.createCategory,
);
router.patch(
  "/categories/:categoryId",
  authorizeRoles("ADMIN"),
  updateCategorySchema,
  validate,
  controller.updateCategory,
);
router.delete(
  "/categories/:categoryId",
  authorizeRoles("ADMIN"),
  categoryIdSchema,
  validate,
  controller.deactivateCategory,
);
router.post(
  "/categories/:categoryId/thumbnail",
  authorizeRoles("ADMIN"),
  thumbnailUpload,
  upload.validateUploadedFiles,
  categoryIdSchema,
  validate,
  controller.uploadCategoryThumbnail,
);
router.post(
  "/",
  authorizeRoles("ADMIN"),
  createServiceSchema,
  validate,
  controller.createService,
);
router.patch(
  "/:serviceId",
  authorizeRoles("ADMIN"),
  updateServiceSchema,
  validate,
  controller.updateService,
);
router.delete(
  "/:serviceId",
  authorizeRoles("ADMIN"),
  serviceIdSchema,
  validate,
  controller.deactivateService,
);
router.post(
  "/:serviceId/thumbnail",
  authorizeRoles("ADMIN"),
  thumbnailUpload,
  upload.validateUploadedFiles,
  serviceIdSchema,
  validate,
  controller.uploadThumbnail,
);

module.exports = router;
