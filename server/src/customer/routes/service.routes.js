const express = require("express");

const serviceController = require("../controllers/service.controller");
const validate = require("../../middlewares/validate.middleware");
const { optionalProtect } = require("../../middlewares/auth.middleware");

const {
  serviceIdParamSchema,
} = require("../validations/service.validation");

const router = express.Router();

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
