const express = require("express");

const garageRequestController = require("../controllers/garageRequest.controller");
const { protect } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const upload = require("../middlewares/upload.middleware");

const {
  acceptGarageRequestSchema,
  rejectGarageRequestSchema,
  verifyHandoverOtpSchema,
  markDeliveredSchema,
} = require("../validations/garageRequest.validation");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("GARAGE_OWNER", "ADMIN"));

router.get("/", garageRequestController.getGarageRequests);
router.get("/:requestId", garageRequestController.getGarageRequestById);

router.post(
  "/:requestId/accept",
  acceptGarageRequestSchema,
  validate,
  garageRequestController.acceptGarageRequest
);


router.post(
  "/:requestId/verify-handover-otp",
  upload.array("images", 5),
  verifyHandoverOtpSchema,
  validate,
  garageRequestController.verifyHandoverOtp
);

router.post(
  "/:requestId/mark-delivered",
  upload.array("images", 5),
  markDeliveredSchema,
  validate,
  garageRequestController.markDelivered
);
router.post(
  "/:requestId/reject",
  rejectGarageRequestSchema,
  validate,
  garageRequestController.rejectGarageRequest
);

module.exports = router;
