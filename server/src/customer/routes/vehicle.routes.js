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

const CUSTOMER_VEHICLE_DAILY_LIMIT = 3;
const CUSTOMER_VEHICLE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

const registrationVerificationRateLimit = rateLimit({
  windowMs: CUSTOMER_VEHICLE_DAILY_WINDOW_MS,
  max: CUSTOMER_VEHICLE_DAILY_LIMIT,
  fallbackMax: CUSTOMER_VEHICLE_DAILY_LIMIT,
  name: "customer-vehicle-registration-daily",
  keyGenerator: (req) => `customer:${req.user.id}`,
  message:
    "You can verify or change a vehicle registration number up to 3 times in 24 hours. Please try again later.",
});

const vehicleCreationRateLimit = rateLimit({
  windowMs: CUSTOMER_VEHICLE_DAILY_WINDOW_MS,
  max: CUSTOMER_VEHICLE_DAILY_LIMIT,
  fallbackMax: CUSTOMER_VEHICLE_DAILY_LIMIT,
  name: "customer-vehicle-create-daily",
  keyGenerator: (req) => `customer:${req.user.id}`,
  message:
    "You can add up to 3 vehicles in 24 hours. Please try again later.",
});

const registrationChangeRateLimit = (req, res, next) => {
  if (req.body?.registrationNumber === undefined) return next();
  return registrationVerificationRateLimit(req, res, next);
};

router.post(
  "/verify-registration",
  verifyRegistrationValidation,
  validate,
  registrationVerificationRateLimit,
  vehicleController.verifyVehicleRegistration,
);

router
  .route("/")
  .post(
    createVehicleValidation,
    validate,
    vehicleCreationRateLimit,
    vehicleController.createVehicle,
  )
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
  .patch(
    updateVehicleValidation,
    validate,
    registrationChangeRateLimit,
    vehicleController.updateVehicle,
  )
  .delete(vehicleIdValidation, validate, vehicleController.deleteVehicle);

module.exports = router;
