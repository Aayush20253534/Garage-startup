const { body, param, query } = require("express-validator");

const garageIdSchema = [
  param("garageId").isUUID().withMessage("Invalid garage ID"),
];

const deleteGaragesSchema = [
  body("garageIds").isArray({ min: 1 }).withMessage("Select at least one garage to delete"),
  body("garageIds.*").isUUID().withMessage("Invalid garage ID"),
];

const serviceIdSchema = [
  ...garageIdSchema,
  param("serviceId").isUUID().withMessage("Invalid service ID"),
  query("vehicleBrand").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  query("vehicleModel").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
];

const garageQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("city").optional({ nullable: true, checkFalsy: true }).trim(),
  query("isActive").optional({ nullable: true, checkFalsy: true }).isBoolean(),
  query("isVerified").optional({ nullable: true, checkFalsy: true }).isBoolean(),
];

const assignableServiceQuerySchema = [
  query("search").optional({ nullable: true, checkFalsy: true }).trim(),
  query("categoryId").optional({ nullable: true, checkFalsy: true }).isUUID(),
];

const upsertGarageServiceSchema = [
  ...garageIdSchema,
  body("serviceId").isUUID().withMessage("Valid service ID is required"),
  body("vehicleBrand").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  body("vehicleModel").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
  body("vehicleScopes")
    .optional({ nullable: true })
    .isArray({ min: 1, max: 100 })
    .withMessage("Select between 1 and 100 vehicle exclusions"),
  body("vehicleScopes.*.vehicleBrand")
    .if(body("vehicleScopes").exists())
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Each exclusion requires a valid vehicle brand"),
  body("vehicleScopes.*.vehicleModel")
    .if(body("vehicleScopes").exists())
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 120 }),
  body("isExcluded").optional({ nullable: true }).isBoolean(),
  body("isActive").optional({ nullable: true }).isBoolean(),
];

const updateGarageStatusSchema = [
  ...garageIdSchema,
  body("isActive")
    .exists()
    .withMessage("Garage status is required")
    .bail()
    .isBoolean()
    .withMessage("Garage status must be boolean")
    .toBoolean(),
];

const updateGarageDetailsSchema = [
  ...garageIdSchema,
  body("name").optional().trim().notEmpty().isLength({ max: 160 }),
  body("ownerName").optional().trim().notEmpty().isLength({ max: 160 }),
  body("ownerEmail").optional({ nullable: true, checkFalsy: true }).trim().isEmail().normalizeEmail(),
  body("ownerPhone").optional().trim().matches(/^\+91[6-9]\d{9}$/).withMessage("Enter a valid Indian owner phone number"),
  body("description").optional({ nullable: true }).trim().isLength({ max: 3000 }),
  body("phone").optional().trim().matches(/^\+91[6-9]\d{9}$/).withMessage("Enter a valid Indian garage phone number"),
  body("whatsappNo").optional({ nullable: true, checkFalsy: true }).trim().matches(/^\+91[6-9]\d{9}$/),
  body("email").optional({ nullable: true, checkFalsy: true }).trim().isEmail().normalizeEmail(),
  body("address").optional().trim().notEmpty().isLength({ max: 500 }),
  body("city").optional().trim().notEmpty().isLength({ max: 120 }),
  body("area").optional().trim().notEmpty().isLength({ max: 120 }),
  body("latitude").optional().isFloat({ min: 6, max: 38 }).toFloat(),
  body("longitude").optional().isFloat({ min: 68, max: 98 }).toFloat(),
  body("workingRadiusKm").optional().isInt({ min: 1, max: 100 }).toInt(),
  body("garageType").optional().isIn(["MULTI_BRAND", "AUTHORIZED"]),
  body("supportedBrands").optional().isArray({ max: 100 }),
  body("supportedBrands.*").optional().trim().isLength({ min: 1, max: 120 }),
  body("excludedServiceBrands").optional().isArray({ max: 100 }),
  body("excludedServiceBrands.*").optional().trim().isLength({ min: 1, max: 120 }),
  body("openingTime").optional({ nullable: true, checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body("closingTime").optional({ nullable: true, checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body("isVerified").optional().isBoolean().toBoolean(),
];

const garageImageSchema = [
  ...garageIdSchema,
  param("imageId").isUUID().withMessage("Invalid garage image ID"),
];

const reorderGarageImagesSchema = [
  ...garageIdSchema,
  body("imageIds").isArray({ min: 1, max: 15 }),
  body("imageIds.*").isUUID().withMessage("Invalid garage image ID"),
];

module.exports = {
  assignableServiceQuerySchema,
  deleteGaragesSchema,
  garageIdSchema,
  garageQuerySchema,
  garageImageSchema,
  reorderGarageImagesSchema,
  serviceIdSchema,
  updateGarageStatusSchema,
  updateGarageDetailsSchema,
  upsertGarageServiceSchema,
};
