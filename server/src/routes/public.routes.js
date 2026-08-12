const express = require("express");

const publicController = require("../controllers/public.controller");

const router = express.Router();

router.get("/stats", publicController.getStats);
router.get("/independence-campaign", publicController.getIndependenceCampaign);

module.exports = router;
