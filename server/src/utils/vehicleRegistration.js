const REGISTRATION_NUMBER_PATTERN = /^[A-Z0-9]{5,11}$/;

const normalizeRegistrationNumber = (value = "") =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

const isValidRegistrationNumber = (value) =>
  REGISTRATION_NUMBER_PATTERN.test(normalizeRegistrationNumber(value));

module.exports = {
  REGISTRATION_NUMBER_PATTERN,
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
};
