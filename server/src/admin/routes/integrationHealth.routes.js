const express = require("express");
const { query } = require("express-validator");

const controller = require("../controllers/integrationHealth.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get(
  "/",
  query("force").optional().isBoolean().toBoolean(),
  validate,
  controller.getIntegrationHealth,
);

module.exports = router;
