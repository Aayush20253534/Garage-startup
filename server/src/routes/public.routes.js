const express = require("express");

const publicController = require("../controllers/public.controller");

const router = express.Router();

router.get("/stats", publicController.getStats);
router.get("/homepage-banners", publicController.getHomepageBanners);

module.exports = router;
