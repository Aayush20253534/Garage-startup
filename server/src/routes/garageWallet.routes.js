const express = require("express");

const garageWalletController = require("../controllers/garageWallet.controller");
const { protectUser } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createRechargeOrderSchema: walletRechargeSchema,
  walletTransactionQuerySchema,
} = require("../garage/validations/wallet.validation");

const router = express.Router();

router.use(protectUser);
router.use(authorizeRoles("GARAGE_OWNER"));

router.get("/", garageWalletController.getGarageWallet);

router.get(
  "/transactions",
  walletTransactionQuerySchema,
  validate,
  garageWalletController.getGarageWalletTransactions
);

router.post(
  "/recharge",
  walletRechargeSchema,
  validate,
  garageWalletController.rechargeGarageWallet
);

module.exports = router;
