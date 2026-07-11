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

router.get("/categories", categoryQuerySchema, validate, controller.listCategories);
router.post("/categories", createCategorySchema, validate, controller.createCategory);
router.patch("/categories/:categoryId", updateCategorySchema, validate, controller.updateCategory);
router.delete(
  "/categories/:categoryId",
  authorizeRoles("ADMIN"),
  categoryIdSchema,
  validate,
  controller.deactivateCategory,
);
router.post(
  "/categories/:categoryId/thumbnail",
  thumbnailUpload,
  upload.validateUploadedFiles,
  categoryIdSchema,
  validate,
  controller.uploadCategoryThumbnail
);
router.post("/", createServiceSchema, validate, controller.createService);
router.patch("/:serviceId", updateServiceSchema, validate, controller.updateService);
router.delete(
  "/:serviceId",
  authorizeRoles("ADMIN"),
  serviceIdSchema,
  validate,
  controller.deactivateService,
);
router.post("/:serviceId/thumbnail", thumbnailUpload, upload.validateUploadedFiles, serviceIdSchema, validate, controller.uploadThumbnail);

module.exports = router;
