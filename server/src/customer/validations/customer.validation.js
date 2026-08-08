const { body } = require("express-validator");
const FUEL_TYPES = require("../../constants/fuelTypes");
const {
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
} = require("../../utils/vehicleRegistration");

const acceptedFuelTypes = Object.values(FUEL_TYPES);

const onboardingValidation = [
  body("vehicle.brand")
    .trim()
    .notEmpty()
    .withMessage("Vehicle brand is required"),

  body("vehicle.model")
    .trim()
    .notEmpty()
    .withMessage("Vehicle model is required"),

  body("vehicle.year")
    .notEmpty()
    .withMessage("Vehicle year is required")
    .isInt({ min: 1980, max: new Date().getFullYear() + 1 })
    .withMessage("Enter a valid vehicle year"),

  body("vehicle.fuelType")
    .trim()
    .notEmpty()
    .withMessage("Fuel type is required")
    .isIn(acceptedFuelTypes)
    .withMessage("Invalid fuel type"),

  body("vehicle.registrationNumber")
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(normalizeRegistrationNumber)
    .custom((value) => isValidRegistrationNumber(value))
    .withMessage("Enter a valid registration number using 5 to 11 letters and numbers"),

  body("location.latitude")
    .notEmpty()
    .withMessage("Latitude is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),

  body("location.longitude")
    .notEmpty()
    .withMessage("Longitude is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),

  body("location.address")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("location.city")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("location.formattedAddress")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("location.addressComponents")
    .optional({ nullable: true })
    .isArray({ max: 30 }),
];
const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),

  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^(\+91)?[6-9]\d{9}$/)
    .withMessage("Phone number must be a valid Indian mobile number"),

  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body("avatarUrl")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isURL()
    .withMessage("Avatar URL must be valid"),
];
const deleteAccountValidation = [
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];
module.exports = {
  onboardingValidation,
  updateProfileValidation,
  deleteAccountValidation,
};
