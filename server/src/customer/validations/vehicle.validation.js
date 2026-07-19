const { body, param } = require("express-validator");

const vehicleIdValidation = [
  param("id").isUUID().withMessage("Invalid vehicle ID"),
];

const createVehicleValidation = [
  body("brand")
    .trim()
    .notEmpty()
    .withMessage("Vehicle brand is required"),

  body("model")
    .trim()
    .notEmpty()
    .withMessage("Vehicle model is required"),

  body("year")
    .notEmpty()
    .withMessage("Vehicle year is required")
    .isInt({ min: 1980, max: new Date().getFullYear() + 1 })
    .withMessage("Enter a valid vehicle year"),

  body("fuelType")
    .trim()
    .notEmpty()
    .withMessage("Fuel type is required")
    .isIn(["PETROL", "DIESEL", "HYBRID", "CNG", "OTHER"])
    .withMessage("Invalid fuel type"),

  body("registrationNumber")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false"),
];

const updateVehicleValidation = [
  param("id").isUUID().withMessage("Invalid vehicle ID"),

  body("brand")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vehicle brand cannot be empty"),

  body("model")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vehicle model cannot be empty"),

  body("year")
    .optional()
    .isInt({ min: 1980, max: new Date().getFullYear() + 1 })
    .withMessage("Enter a valid vehicle year"),

  body("fuelType")
    .optional()
    .trim()
    .isIn(["PETROL", "DIESEL", "HYBRID", "CNG", "OTHER"])
    .withMessage("Invalid fuel type"),

  body("registrationNumber")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false"),
];

module.exports = {
  vehicleIdValidation,
  createVehicleValidation,
  updateVehicleValidation,
};
