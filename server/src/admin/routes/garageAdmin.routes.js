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
  serviceIdSchema,
  upsertGarageServiceSchema,
} = require("../validations/garageAdmin.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/", garageQuerySchema, validate, controller.listGarages);
router.get("/services", assignableServiceQuerySchema, validate, controller.listAssignableServices);
router.get("/:garageId", garageIdSchema, validate, controller.getGarage);
router.delete(
  "/",
  authorizeRoles("ADMIN"),
  deleteGaragesSchema,
  validate,
  controller.deleteGarages,
);
router.post(
  "/:garageId/services",
  authorizeRoles("ADMIN"),
  upsertGarageServiceSchema,
  validate,
  controller.upsertGarageService,
);
router.delete(
  "/:garageId/services/:serviceId",
  authorizeRoles("ADMIN"),
  serviceIdSchema,
  validate,
  controller.removeGarageService,
);

module.exports = router;
