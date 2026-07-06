const { body, param } = require("express-validator");

const reviewIdValidation = [
  param("id").isUUID().withMessage("Invalid review ID"),
];

const createReviewValidation = [
  body("bookingId").isUUID().withMessage("Valid booking ID is required"),

  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Review comment cannot exceed 1000 characters"),
];

const updateReviewValidation = [
  param("id").isUUID().withMessage("Invalid review ID"),

  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Review comment cannot exceed 1000 characters"),
];

module.exports = {
  reviewIdValidation,
  createReviewValidation,
  updateReviewValidation,
};
