const express = require("express");

const vehicleController = require("../controllers/vehicle.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");

const {
  vehicleIdValidation,
  createVehicleValidation,
  updateVehicleValidation,
  verifyRegistrationValidation,
} = require("../validations/vehicle.validation");

const router = express.Router();

router.use(protect);

const registrationVerificationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  fallbackMax: 3,
  name: "vehicle-registration-verification",
  keyGenerator: (req) => `customer:${req.user.id}`,
  message: "Too many vehicle verification attempts. Please try again later.",
});

router.post(
  "/verify-registration",
  registrationVerificationRateLimit,
  verifyRegistrationValidation,
  validate,
  vehicleController.verifyVehicleRegistration,
);

router
  .route("/")
  .post(createVehicleValidation, validate, vehicleController.createVehicle)
  .get(vehicleController.getMyVehicles);

router.patch(
  "/:id/default",
  vehicleIdValidation,
  validate,
  vehicleController.setDefaultVehicle
);

router
  .route("/:id")
  .get(vehicleIdValidation, validate, vehicleController.getVehicleById)
  .patch(updateVehicleValidation, validate, vehicleController.updateVehicle)
  .delete(vehicleIdValidation, validate, vehicleController.deleteVehicle);

module.exports = router;
