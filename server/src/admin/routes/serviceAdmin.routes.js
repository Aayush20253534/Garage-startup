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
const thumbnailUpload = upload.single("thumbnail");

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/categories", categoryQuerySchema, validate, controller.listCategories);
router.post("/categories", createCategorySchema, validate, controller.createCategory);
router.patch("/categories/:categoryId", updateCategorySchema, validate, controller.updateCategory);
router.delete("/categories/:categoryId", categoryIdSchema, validate, controller.deactivateCategory);
router.post(
  "/categories/:categoryId/thumbnail",
  thumbnailUpload,
  categoryIdSchema,
  validate,
  controller.uploadCategoryThumbnail
);
router.post("/", createServiceSchema, validate, controller.createService);
router.patch("/:serviceId", updateServiceSchema, validate, controller.updateService);
router.delete("/:serviceId", serviceIdSchema, validate, controller.deactivateService);
router.post("/:serviceId/thumbnail", thumbnailUpload, serviceIdSchema, validate, controller.uploadThumbnail);

module.exports = router;
