const express = require("express");

const pushController = require("../controllers/push.controller");
const { protectUser } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(protectUser);

router.get("/public-key", pushController.getPublicConfig);
router.post("/subscriptions", pushController.subscribe);
router.delete("/subscriptions", pushController.unsubscribe);

module.exports = router;
