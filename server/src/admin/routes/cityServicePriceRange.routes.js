const express = require("express");

const controller = require("../controllers/cityServicePriceRange.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  createPriceRangeSchema,
  priceRangeIdSchema,
  priceRangeQuerySchema,
  updatePriceRangeSchema,
} = require("../validations/cityServicePriceRange.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "INTERN"));

router.get("/", priceRangeQuerySchema, validate, controller.listPriceRanges);
router.post("/", createPriceRangeSchema, validate, controller.createPriceRange);
router.get("/:id", priceRangeIdSchema, validate, controller.getPriceRange);
router.patch("/:id", updatePriceRangeSchema, validate, controller.updatePriceRange);
router.delete(
  "/:id",
  authorizeRoles("ADMIN"),
  priceRangeIdSchema,
  validate,
  controller.deletePriceRange,
);

module.exports = router;
