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
const logoUpload = upload.single("logo");

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/brands", brandQuerySchema, validate, controller.listBrands);
router.post("/brands", logoUpload, createBrandSchema, validate, controller.createBrand);
router.get("/brands/:brandId", brandIdSchema, validate, controller.getBrand);
router.patch("/brands/:brandId", logoUpload, updateBrandSchema, validate, controller.updateBrand);
router.delete("/brands/:brandId", brandIdSchema, validate, controller.deactivateBrand);
router.post("/brands/:brandId/models", createModelSchema, validate, controller.createModel);
router.patch("/models/:modelId", updateModelSchema, validate, controller.updateModel);
router.delete("/models/:modelId", modelIdSchema, validate, controller.deactivateModel);

module.exports = router;
