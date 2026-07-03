const express = require("express");

const garageController = require("../controllers/garage.controller");
const { protect } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", garageController.getGarages);
router.get("/nearby", protect, garageController.getNearbyGarages);
router.get("/me", protect, garageController.getMyGarage);
router.get("/me/services", protect, garageController.getMyGarageServices);
router.put("/me", protect, garageController.updateMyGarage);

router.get("/:id", garageController.getGarageById);
router.get("/:id/services", garageController.getGarageServices);

module.exports = router;
