const express = require("express");

const serviceMediaController = require("../controllers/serviceMedia.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");

const {
  serviceIdParamSchema,
  serviceMediaIdParamSchema,
  addServiceMediaSchema,
  updateServiceMediaSchema,
} = require("../validations/serviceMedia.validation");

const router = express.Router();

router.get(
  "/:serviceId/media",
  serviceIdParamSchema,
  validate,
  serviceMediaController.getServiceMedia
);

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN"));

router.post(
  "/:serviceId/media",
  addServiceMediaSchema,
  validate,
  serviceMediaController.addServiceMedia
);

router.patch(
  "/media/:mediaId",
  updateServiceMediaSchema,
  validate,
  serviceMediaController.updateServiceMedia
);

router.delete(
  "/media/:mediaId",
  serviceMediaIdParamSchema,
  validate,
  serviceMediaController.deleteServiceMedia
);

module.exports = router;
