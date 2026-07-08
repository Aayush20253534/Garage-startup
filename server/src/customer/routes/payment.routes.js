const express = require("express");

const paymentController = require("../controllers/payment.controller");
const { protect } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");

const {
  cancelPaymentOrderValidation,
  createPaymentOrderValidation,
  verifyPaymentValidation,
} = require("../validations/payment.validation");

const router = express.Router();

router.use(protect);
router.get("/", paymentController.getMyPayments);
router.post(
  "/create-order",
  createPaymentOrderValidation,
  validate,
  paymentController.createPaymentOrder
);

router.post(
  "/verify",
  verifyPaymentValidation,
  validate,
  paymentController.verifyPayment
);

router.post(
  "/cancel",
  cancelPaymentOrderValidation,
  validate,
  paymentController.cancelPaymentOrder
);

module.exports = router;
