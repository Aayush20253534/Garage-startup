const express = require("express");

const serviceController = require("../controllers/service.controller");
const validate = require("../../middlewares/validate.middleware");
const { optionalProtect } = require("../../middlewares/auth.middleware");

const {
  serviceIdParamSchema,
  servicePricingQuerySchema,
} = require("../validations/service.validation");

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

router.get(
  "/categories",
  optionalProtect,
  servicePricingQuerySchema,
  validate,
  serviceController.getServiceCategories,
);
router.get(
  "/",
  optionalProtect,
  servicePricingQuerySchema,
  validate,
  serviceController.getServices,
);

router.get(
  "/:id",
  optionalProtect,
  servicePricingQuerySchema,
  serviceIdParamSchema,
  validate,
  serviceController.getServiceById
);

module.exports = router;
