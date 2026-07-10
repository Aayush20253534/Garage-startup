const express = require("express");

const controller = require("../controllers/customerSupportAccount.controller");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const rules = require("../validations/customerSupportAccount.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/", controller.listAccounts);
router.post("/", rules.createAccount, validate, controller.createAccount);
router.patch(
  "/:accountId",
  rules.updateAccount,
  validate,
  controller.updateAccount,
);
router.patch(
  "/:accountId/password",
  rules.password,
  validate,
  controller.changePassword,
);

module.exports = router;
