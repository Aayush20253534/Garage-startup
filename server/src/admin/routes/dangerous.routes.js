const express = require("express");

const controller = require("../controllers/dangerous.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  runDangerousCommandSchema,
} = require("../validations/dangerous.validation");

const router = express.Router();

const dangerousRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  fallbackMax: 2,
  keyGenerator: (req) => `admin-dangerous:${req.user?.id || req.ip}`,
});

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/commands", controller.listDangerousCommands);
router.post(
  "/commands/:command/download",
  dangerousRateLimit,
  runDangerousCommandSchema,
  validate,
  controller.downloadDbBackup,
);
router.post(
  "/commands/:command/run",
  dangerousRateLimit,
  runDangerousCommandSchema,
  validate,
  controller.runDangerousCommand,
);

module.exports = router;
