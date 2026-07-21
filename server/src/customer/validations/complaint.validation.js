const { body, param, query } = require("express-validator");

const listComplaintsValidation = [
  query("limit").optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }),
  query("cursor").optional({ checkFalsy: true }).isString().isLength({ max: 512 }),
];

const complaintIdValidation = [
  param("id").isUUID().withMessage("Invalid complaint ID"),
];

const createComplaintValidation = [
  body("bookingId")
    .optional({ nullable: true, checkFalsy: true })
    .isUUID()
    .withMessage("Invalid booking ID"),

  body("title").trim().notEmpty().withMessage("Complaint title is required"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Complaint description is required"),
];

module.exports = {
  complaintIdValidation,
  createComplaintValidation,
  listComplaintsValidation,
};
