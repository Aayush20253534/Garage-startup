const express = require("express");

const controller = require("../controllers/city.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  cityQuerySchema,
  createCitySchema,
  updateCitySchema,
} = require("../validations/city.validation");

const router = express.Router();

router.get("/", controller.listPublicCities);

router.get("/admin", protect, authorizeRoles("ADMIN", "INTERN"), cityQuerySchema, validate, controller.listAdminCities);
router.post("/admin", protect, authorizeRoles("ADMIN", "INTERN"), createCitySchema, validate, controller.createCity);
router.patch("/admin/:cityId", protect, authorizeRoles("ADMIN", "INTERN"), updateCitySchema, validate, controller.updateCity);

module.exports = router;
