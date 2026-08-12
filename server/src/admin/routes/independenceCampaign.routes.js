const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/independenceCampaign.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");

const router = express.Router();
router.use(protect, authorizeRoles("ADMIN", "SUB_ADMIN"));
router.get("/", controller.getSettings);
router.patch(
  "/",
  body("mode").isIn(["OFF", "MANUAL", "SCHEDULED"]),
  body("manualEnabled").optional().isBoolean(),
  body("startsAt").optional({ nullable: true }).isISO8601(),
  body("endsAt").optional({ nullable: true }).isISO8601(),
  validate,
  controller.updateSettings,
);
module.exports = router;
