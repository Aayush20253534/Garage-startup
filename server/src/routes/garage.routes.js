const express = require("express");

const garageController = require("../controllers/garage.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/", garageController.getGarages);

router.get(
  "/nearby",
  protect,
  authorizeRoles("CUSTOMER", "ADMIN"),
  garageController.getNearbyGarages,
);

router.get(
  "/me",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageController.getMyGarage,
);

router.get(
  "/me/services",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageController.getMyGarageServices,
);

router.put(
  "/me",
  protect,
  authorizeRoles("GARAGE_OWNER", "ADMIN"),
  garageController.updateMyGarage,
);

router.get("/:id", garageController.getGarageById);
router.get("/:id/services", garageController.getGarageServices);

module.exports = router;
