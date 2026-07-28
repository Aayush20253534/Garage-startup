const express = require("express");

const controller = require("../controllers/garageWorkerTask.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const rateLimit = require("../middlewares/rateLimit.middleware");

const router = express.Router();

const managerMutationLimit = rateLimit({
  name: "garage-worker-task-manager",
  windowMs: 60 * 1000,
  max: 30,
  fallbackMax: 15,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || "manager"}`,
});

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN", "GARAGE_OWNER"));

router.get("/booking/:bookingId", controller.listTasks);
router.post("/booking/:bookingId", managerMutationLimit, controller.createTask);
router.post("/:taskId/resend", managerMutationLimit, controller.resendTask);
router.post("/:taskId/revoke", managerMutationLimit, controller.revokeTask);

module.exports = router;
