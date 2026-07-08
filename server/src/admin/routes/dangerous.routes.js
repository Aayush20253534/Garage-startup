const express = require("express");

const controller = require("../controllers/dangerous.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  runDangerousCommandSchema,
} = require("../validations/dangerous.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/commands", controller.listDangerousCommands);
router.post(
  "/commands/:command/download",
  runDangerousCommandSchema,
  validate,
  controller.downloadSqlBackup,
);
router.post(
  "/commands/:command/run",
  runDangerousCommandSchema,
  validate,
  controller.runDangerousCommand,
);

module.exports = router;
