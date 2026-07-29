const express = require("express");
const { body } = require("express-validator");

const controller = require("../controllers/pseudoData.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  MAX_EXTRA,
  MIN_RATING,
  MAX_RATING,
} = require("../services/pseudoData.service");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN", "SUB_ADMIN"));

router.get("/", controller.getPseudoData);

router.patch(
  "/",
  body("enabled").isBoolean().withMessage("enabled must be a boolean"),
  body("extraUsers")
    .optional()
    .isInt({ min: 0, max: MAX_EXTRA })
    .withMessage(`extraUsers must be 0–${MAX_EXTRA}`),
  body("extraGarages")
    .optional()
    .isInt({ min: 0, max: MAX_EXTRA })
    .withMessage(`extraGarages must be 0–${MAX_EXTRA}`),
  body("pseudoAverageRating")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === "" || value === undefined) return true;
      const n = Number(value);
      if (!Number.isFinite(n) || n < MIN_RATING || n > MAX_RATING) {
        throw new Error(
          `pseudoAverageRating must be between ${MIN_RATING} and ${MAX_RATING}, or null`,
        );
      }
      return true;
    }),
  validate,
  controller.updatePseudoData,
);

module.exports = router;
