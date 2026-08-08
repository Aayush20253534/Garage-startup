const { body, param } = require("express-validator");
const FUEL_TYPES = require("../../constants/fuelTypes");
const {
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
} = require("../../utils/vehicleRegistration");

const acceptedFuelTypes = Object.values(FUEL_TYPES);

const vehicleIdValidation = [
  param("id").isUUID().withMessage("Invalid vehicle ID"),
];

const optionalRegistrationValidation = () =>
  body("registrationNumber")
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(normalizeRegistrationNumber)
    .custom((value) => isValidRegistrationNumber(value))
    .withMessage("Enter a valid registration number using 5 to 11 letters and numbers");

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
    .isIn(acceptedFuelTypes)
    .withMessage("Invalid fuel type"),

  optionalRegistrationValidation(),

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
    .isIn(acceptedFuelTypes)
    .withMessage("Invalid fuel type"),

  optionalRegistrationValidation(),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false"),
];

const verifyRegistrationValidation = [
  body("registrationNumber")
    .notEmpty()
    .withMessage("Registration number is required")
    .customSanitizer(normalizeRegistrationNumber)
    .custom((value) => isValidRegistrationNumber(value))
    .withMessage("Enter a valid registration number using 5 to 11 letters and numbers"),
  body("brand").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  body("model").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 160 }),
  body("fuelType")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isIn(acceptedFuelTypes),
];

module.exports = {
  vehicleIdValidation,
  createVehicleValidation,
  updateVehicleValidation,
  verifyRegistrationValidation,
};
