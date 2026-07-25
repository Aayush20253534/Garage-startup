const express = require("express");

const controller = require("../controllers/garageAdmin.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  assignableServiceQuerySchema,
  deleteGaragesSchema,
  garageIdSchema,
  garageQuerySchema,
  garageImageSchema,
  reorderGarageImagesSchema,
  serviceIdSchema,
  updateGarageStatusSchema,
  updateGarageDetailsSchema,
  upsertGarageServiceSchema,
} = require("../validations/garageAdmin.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN", "INTERN"));

router.get("/", garageQuerySchema, validate, controller.listGarages);
router.get("/services", assignableServiceQuerySchema, validate, controller.listAssignableServices);
router.get("/:garageId", garageIdSchema, validate, controller.getGarage);
router.patch("/:garageId", authorizeRoles("ADMIN", "SUB_ADMIN"), updateGarageDetailsSchema, validate, controller.updateGarageDetails);
router.patch("/:garageId/images/order", authorizeRoles("ADMIN", "SUB_ADMIN"), reorderGarageImagesSchema, validate, controller.reorderGarageImages);
router.patch("/:garageId/images/:imageId/thumbnail", authorizeRoles("ADMIN", "SUB_ADMIN"), garageImageSchema, validate, controller.setGarageThumbnail);
router.patch(
  "/:garageId/status",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  updateGarageStatusSchema,
  validate,
  controller.setGarageActiveStatus,
);
router.delete(
  "/",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  deleteGaragesSchema,
  validate,
  controller.deleteGarages,
);
router.post(
  "/:garageId/services",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  upsertGarageServiceSchema,
  validate,
  controller.upsertGarageService,
);
router.delete(
  "/:garageId/services/:serviceId",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  serviceIdSchema,
  validate,
  controller.removeGarageService,
);

module.exports = router;
