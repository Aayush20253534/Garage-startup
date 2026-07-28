const express = require("express");

const warrantyController = require("../controllers/warranty.controller");

const router = express.Router();

router.get("/", warrantyController.getMyWarranties);

module.exports = router;
