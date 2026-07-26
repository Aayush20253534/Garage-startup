const express = require("express");

const controller = require("../controllers/cityServicePriceRange.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  createPriceRangeSchema,
  deletePriceRangeSubmissionsSchema,
  deletePriceRangesSchema,
  editPriceRangeSubmissionSchema,
  priceRangeFilterOptionsQuerySchema,
  priceRangeIdSchema,
  priceRangeSubmissionIdSchema,
  priceRangeQuerySchema,
  reviewSubmissionSchema,
  submissionQuerySchema,
  updatePriceRangeSchema,
  upsertCityPriceDiscountSchema,
} = require("../validations/cityServicePriceRange.validation");

const router = express.Router();

const bulkDeleteStepUpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  fallbackMax: 2,
  keyGenerator: (req) => `admin-price-range-delete:${req.user?.id || req.ip}`,
});

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN", "INTERN"));


router.get(
  "/city-discounts",
  controller.listCityPriceDiscounts,
);
router.put(
  "/city-discounts",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  upsertCityPriceDiscountSchema,
  validate,
  controller.upsertCityPriceDiscount,
);

router.get("/", priceRangeQuerySchema, validate, controller.listPriceRanges);
router.get(
  "/filter-options",
  priceRangeFilterOptionsQuerySchema,
  validate,
  controller.listPriceRangeFilterOptions,
);
router.get(
  "/submissions",
  submissionQuerySchema,
  validate,
  controller.listPriceRangeSubmissions,
);
router.post(
  "/",
  authorizeRoles("ADMIN", "SUB_ADMIN", "INTERN"),
  createPriceRangeSchema,
  validate,
  controller.createPriceRange,
);
router.post(
  "/submissions/approve-all",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  controller.approveAllPriceRangeSubmissions,
);
router.patch(
  "/submissions/:id/review",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  reviewSubmissionSchema,
  validate,
  controller.reviewPriceRangeSubmission,
);
router.patch(
  "/submissions/:id",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  editPriceRangeSubmissionSchema,
  validate,
  controller.editPriceRangeSubmission,
);
router.delete(
  "/submissions",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  deletePriceRangeSubmissionsSchema,
  validate,
  controller.deletePriceRangeSubmissions,
);
router.delete(
  "/submissions/:id",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  priceRangeSubmissionIdSchema,
  validate,
  controller.deletePriceRangeSubmission,
);
router.get("/:id", priceRangeIdSchema, validate, controller.getPriceRange);
router.patch(
  "/:id",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  updatePriceRangeSchema,
  validate,
  controller.updatePriceRange,
);
router.delete(
  "/",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  bulkDeleteStepUpRateLimit,
  deletePriceRangesSchema,
  validate,
  controller.deletePriceRanges,
);
router.delete(
  "/:id",
  authorizeRoles("ADMIN", "SUB_ADMIN"),
  priceRangeIdSchema,
  validate,
  controller.deletePriceRange,
);

module.exports = router;
