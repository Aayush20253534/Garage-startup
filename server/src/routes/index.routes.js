const express = require("express");

const notificationRoutes = require("../customer/routes/notification.routes");
const vehicleMetaRoutes = require("../customer/routes/vehicleMeta.routes");
const authRoutes = require("../customer/routes/auth.routes");
const customerRoutes = require("../customer/routes/customer.routes");
const vehicleRoutes = require("../customer/routes/vehicle.routes");
const locationRoutes = require("../customer/routes/location.routes");
const serviceRoutes = require("../customer/routes/service.routes");
const garageRoutes = require("./garage.routes");
const garageApplicationRoutes = require("../garage/routes/application.routes");
const bookingRoutes = require("../customer/routes/booking.routes");
const paymentRoutes = require("../customer/routes/payment.routes");
const reviewRoutes = require("../customer/routes/review.routes");
const complaintRoutes = require("../customer/routes/complaint.routes");
const garageMediaRoutes = require("./garageMedia.routes");

const walletRoutes = require("../customer/routes/wallet.routes");
const garageWalletRoutes = require("./garageWallet.routes");
const newGarageWalletRoutes = require("../garage/routes/wallet.routes");
const garageRequestRoutes = require("./garageRequest.routes");
const serviceMediaRoutes = require("../customer/routes/serviceMedia.routes");
const sosRoutes = require("../customer/routes/sos.routes");
const contactRoutes = require("../customer/routes/contact.routes");
const dashboardRoutes = require("../customer/routes/dashboard.routes");
const chatbotRoutes = require("../customer/routes/chatbot.routes");
const publicRoutes = require("./public.routes");
const cityRoutes = require("./city.routes");
const adminGarageApplicationRoutes = require("../admin/routes/garageApplication.routes");
const cityServicePriceRangeRoutes = require("../admin/routes/cityServicePriceRange.routes");
const adminGarageRoutes = require("../admin/routes/garageAdmin.routes");
const adminOperationsRoutes = require("../admin/routes/adminOperations.routes");
const authController = require("../customer/controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const rateLimit = require("../middlewares/rateLimit.middleware");
const { otpSendRateLimits } = require("../middlewares/otpRateLimit.middleware");
const {
  sendPhoneOtpValidation,
  verifyPhoneOtpValidation,
} = require("../customer/validations/auth.validation");
const router = express.Router();
const publicOtpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${req.body?.phone || "otp"}`,
});

router.use("/auth", authRoutes);
router.use("/public", publicRoutes);
router.use("/cities", cityRoutes);
router.post("/send-otp", sendPhoneOtpValidation, validate, otpSendRateLimits, publicOtpRateLimit, authController.sendPhoneOtp);
router.post("/verify-otp", publicOtpRateLimit, verifyPhoneOtpValidation, validate, authController.verifyPhoneOtp);
router.use("/customer", customerRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/locations", locationRoutes);
router.use("/contact", contactRoutes);
router.use("/services", serviceRoutes);
router.use("/services", serviceMediaRoutes);
router.use("/vehicle-meta", vehicleMetaRoutes);
router.use("/garages", garageRoutes);
router.use("/garage/applications", garageApplicationRoutes);
router.use("/garages", garageMediaRoutes);
router.use("/notifications", notificationRoutes);
router.use("/bookings", bookingRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/complaints", complaintRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/wallet", walletRoutes);
router.use("/garage/wallet", newGarageWalletRoutes);
router.use("/garage/wallet-legacy", garageWalletRoutes);
router.use("/garage/requests", garageRequestRoutes);
router.use("/admin/garage-applications", adminGarageApplicationRoutes);
router.use("/admin/city-service-price-ranges", cityServicePriceRangeRoutes);
router.use("/admin/garages", adminGarageRoutes);
router.use("/admin", adminOperationsRoutes);
router.use("/sos", sosRoutes);

module.exports = router;
