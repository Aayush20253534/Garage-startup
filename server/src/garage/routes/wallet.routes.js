const express = require("express");

const walletController = require("../controllers/wallet.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  createRechargeOrderSchema,
  verifyRechargeOrderSchema,
  walletTransactionQuerySchema,
} = require("../validations/wallet.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER"));

router.get("/", walletController.getWallet);
router.get("/transactions", walletTransactionQuerySchema, validate, walletController.getTransactions);
router.post("/recharge/order", createRechargeOrderSchema, validate, walletController.createRechargeOrder);
router.post("/recharge/verify", verifyRechargeOrderSchema, validate, walletController.verifyRechargeOrder);

module.exports = router;
