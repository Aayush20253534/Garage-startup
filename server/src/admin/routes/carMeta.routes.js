const express = require("express");

const controller = require("../controllers/carMeta.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const upload = require("../../middlewares/upload.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  brandIdSchema,
  brandQuerySchema,
  createBrandSchema,
  createModelSchema,
  modelIdSchema,
  updateBrandSchema,
  updateModelSchema,
} = require("../validations/carMeta.validation");

const router = express.Router();
const logoUpload = upload.createUpload({
  fileSize: 2 * 1024 * 1024,
  files: 1,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
}).single("logo");
const modelPhotoUpload = upload.createUpload({
  fileSize: 2 * 1024 * 1024,
  files: 1,
  allowedMimeTypes: upload.IMAGE_MIME_TYPES,
}).single("photo");

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN", "INTERN"));

router.get("/brands", brandQuerySchema, validate, controller.listBrands);
router.post("/brands", authorizeRoles("ADMIN", "SUB_ADMIN"), logoUpload, upload.validateUploadedFiles, createBrandSchema, validate, controller.createBrand);
router.get("/brands/:brandId", brandIdSchema, validate, controller.getBrand);
router.patch("/brands/:brandId", authorizeRoles("ADMIN", "SUB_ADMIN"), logoUpload, upload.validateUploadedFiles, updateBrandSchema, validate, controller.updateBrand);
router.delete("/brands/:brandId", authorizeRoles("ADMIN", "SUB_ADMIN"), brandIdSchema, validate, controller.deactivateBrand);
router.post("/brands/:brandId/models", authorizeRoles("ADMIN", "SUB_ADMIN"), modelPhotoUpload, upload.validateUploadedFiles, createModelSchema, validate, controller.createModel);
router.patch("/models/:modelId", authorizeRoles("ADMIN", "SUB_ADMIN"), modelPhotoUpload, upload.validateUploadedFiles, updateModelSchema, validate, controller.updateModel);
router.delete("/models/:modelId", authorizeRoles("ADMIN", "SUB_ADMIN"), modelIdSchema, validate, controller.deleteModel);

module.exports = router;
