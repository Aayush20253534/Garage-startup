const express = require("express");

const activityController = require("../controllers/activity.controller");
const { protect } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.use(protect);

router.get("/", activityController.listActivities);
router.post("/", activityController.createActivity);

module.exports = router;
