const express = require("express");

const controller = require("../controllers/cityServicePriceRange.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  createPriceRangeSchema,
  deletePriceRangesSchema,
  priceRangeIdSchema,
  priceRangeQuerySchema,
  updatePriceRangeSchema,
} = require("../validations/cityServicePriceRange.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/", priceRangeQuerySchema, validate, controller.listPriceRanges);
router.get("/:id", priceRangeIdSchema, validate, controller.getPriceRange);
router.post(
  "/",
  authorizeRoles("ADMIN", "INTERN"),
  createPriceRangeSchema,
  validate,
  controller.createPriceRange,
);
router.patch(
  "/:id",
  authorizeRoles("ADMIN"),
  updatePriceRangeSchema,
  validate,
  controller.updatePriceRange,
);
router.delete(
  "/",
  authorizeRoles("ADMIN"),
  deletePriceRangesSchema,
  validate,
  controller.deletePriceRanges,
);
router.delete(
  "/:id",
  authorizeRoles("ADMIN"),
  priceRangeIdSchema,
  validate,
  controller.deletePriceRange,
);

module.exports = router;
