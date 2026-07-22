const express = require("express");
const controller = require("../controllers/controller.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const rules = require("../validations/controller.validation");

const router = express.Router();
router.use(protect);
router.use(authorizeRoles("GARAGE_CONTROLLER"));
router.get("/dashboard", controller.dashboard);
router.patch("/availability", rules.availability, validate, controller.availability);
module.exports = router;
