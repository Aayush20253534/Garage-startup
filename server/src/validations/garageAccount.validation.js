const { body } = require("express-validator");

const PHONE_PATTERN = /^\+91[6-9]\d{9}$/;
const ALLOWED_UPDATE_FIELDS = new Set([
  "name",
  "description",
  "phone",
  "whatsappNo",
  "email",
  "address",
  "city",
  "area",
  "latitude",
  "longitude",
  "workingRadiusKm",
  "garageType",
  "fulfillmentMode",
  "supportedBrands",
]);

const parseSupportedBrands = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Comma-separated form values are accepted below.
  }

  return String(value).split(",");
};

const updateGarageAccountValidation = [
  body().custom((value) => {
    const payload = value && typeof value === "object" ? value : {};
    const unknownFields = Object.keys(payload).filter(
      (key) => !ALLOWED_UPDATE_FIELDS.has(key),
    );

    if (unknownFields.length) {
      throw new Error(`Unsupported garage profile fields: ${unknownFields.join(", ")}`);
    }

    if (Object.keys(payload).length === 0) {
      throw new Error("Provide at least one garage profile field to update");
    }

    return true;
  }),
  body("name").optional().isString().trim().isLength({ min: 2, max: 120 }),
  body("description")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 2000 }),
  body("phone")
    .optional()
    .isString()
    .trim()
    .matches(PHONE_PATTERN)
    .withMessage("Phone number must be a valid Indian mobile number"),
  body("whatsappNo")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .matches(PHONE_PATTERN)
    .withMessage("WhatsApp number must be a valid Indian mobile number"),
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .normalizeEmail(),
  body("address").optional().isString().trim().isLength({ min: 3, max: 300 }),
  body("city").optional().isString().trim().isLength({ min: 2, max: 80 }),
  body("area").optional().isString().trim().isLength({ min: 2, max: 120 }),
  body("latitude").optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body("longitude")
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 }),
  body("workingRadiusKm")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Working radius must be between 1 and 100 km"),
  body("garageType")
    .optional()
    .isIn(["MULTI_BRAND", "AUTHORIZED"])
    .withMessage("Garage type must be MULTI_BRAND or AUTHORIZED"),
  body("fulfillmentMode")
    .optional()
    .isIn(["BOTH", "SELF_DROP_OFF"])
    .withMessage("Vehicle handover must be BOTH or SELF_DROP_OFF"),
  body("supportedBrands").optional().custom((value) => {
    const brands = parseSupportedBrands(value)
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (brands.length > 25) {
      throw new Error("A maximum of 25 supported brands is allowed");
    }

    if (brands.some((brand) => brand.length > 60)) {
      throw new Error("Each supported brand must be 60 characters or fewer");
    }

    return true;
  }),
];

const deleteGarageAccountValidation = [
  body().custom((value) => {
    const currentPassword = String(value?.currentPassword || "").trim();
    const otp = String(value?.otp || "").trim();

    if (!currentPassword && !otp) {
      throw new Error("Enter your current password or email OTP");
    }

    if (otp && !/^\d{6}$/.test(otp)) {
      throw new Error("OTP must be 6 digits");
    }

    return true;
  }),
];

module.exports = {
  deleteGarageAccountValidation,
  updateGarageAccountValidation,
};
