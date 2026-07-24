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
router.use(authorizeRoles("ADMIN", "SUB_ADMIN", "INTERN"));

// Interns have read-only access. Approval, denial, deletion, and change requests
// remain admin decisions because they create accounts and alter marketplace access.
router.get("/", applicationQuerySchema, validate, applicationController.listApplications);
router.get("/:applicationId", applicationIdSchema, validate, applicationController.getApplication);
router.delete("/", authorizeRoles("ADMIN"), applicationController.deleteApplications);
router.post(
  "/:applicationId/approve",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  reviewApplicationSchema,
  validate,
  applicationController.approveApplication,
);
router.post(
  "/:applicationId/request-changes",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  reviewApplicationSchema,
  validate,
  applicationController.requestChanges,
);
router.post(
  "/:applicationId/deny",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  reviewApplicationSchema,
  validate,
  applicationController.denyApplication,
);

module.exports = router;
