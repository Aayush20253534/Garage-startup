const express = require("express");

const controller = require("../controllers/systemIssue.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  issueIdSchema,
  issueQuerySchema,
  updateIssueStatusSchema,
} = require("../validations/systemIssue.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/stats", controller.getIssueStats);
router.get("/", issueQuerySchema, validate, controller.listIssues);
router.get("/:issueId", issueIdSchema, validate, controller.getIssue);
router.delete("/resolved", authorizeRoles("ADMIN"), controller.clearResolvedIssues);
router.patch(
  "/:issueId/status",
  authorizeRoles("ADMIN"),
  updateIssueStatusSchema,
  validate,
  controller.updateIssueStatus,
);
router.delete(
  "/:issueId",
  authorizeRoles("ADMIN"),
  issueIdSchema,
  validate,
  controller.deleteIssue,
);

module.exports = router;
