const express = require("express");

const serviceController = require("../controllers/service.controller");
const validate = require("../../middlewares/validate.middleware");
const { optionalProtect } = require("../../middlewares/auth.middleware");

const {
  serviceIdParamSchema,
} = require("../validations/service.validation");

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

router.get("/categories", optionalProtect, serviceController.getServiceCategories);
router.get("/", optionalProtect, serviceController.getServices);

router.get(
  "/:id",
  optionalProtect,
  serviceIdParamSchema,
  validate,
  serviceController.getServiceById
);

module.exports = router;
