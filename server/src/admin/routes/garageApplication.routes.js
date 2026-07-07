const express = require("express");

const applicationController = require("../../garage/controllers/application.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  applicationIdSchema,
  applicationQuerySchema,
  reviewApplicationSchema,
} = require("../../garage/validations/application.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/", applicationQuerySchema, validate, applicationController.listApplications);
router.delete("/", applicationController.deleteApplications);
router.get("/:applicationId", applicationIdSchema, validate, applicationController.getApplication);
router.post("/:applicationId/approve", reviewApplicationSchema, validate, applicationController.approveApplication);
router.post("/:applicationId/request-changes", reviewApplicationSchema, validate, applicationController.requestChanges);
router.post("/:applicationId/deny", reviewApplicationSchema, validate, applicationController.denyApplication);

module.exports = router;
