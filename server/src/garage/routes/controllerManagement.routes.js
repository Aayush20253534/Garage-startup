const express = require("express");
const controller = require("../controllers/controller.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const rules = require("../validations/controller.validation");

const router = express.Router();
router.use(protect);
router.use(authorizeRoles("GARAGE_OWNER"));
router.get("/", controller.list);
router.get("/:controllerId/activity", rules.controllerId, validate, controller.activity);
router.post("/", rules.create, validate, controller.create);
router.patch("/:controllerId", rules.update, validate, controller.update);
router.patch("/:controllerId/password", rules.password, validate, controller.resetPassword);
router.post("/:controllerId/revoke-sessions", rules.controllerId, validate, controller.revokeSessions);
router.delete("/:controllerId", rules.controllerId, validate, controller.remove);
router.post("/bookings/:bookingId/transfer", rules.transfer, validate, controller.transfer);
module.exports = router;
