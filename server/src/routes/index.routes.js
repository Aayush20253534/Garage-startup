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
const paymentWebhookRoutes = require("../customer/routes/paymentWebhook.routes");
const reviewRoutes = require("../customer/routes/review.routes");
const complaintRoutes = require("../customer/routes/complaint.routes");
const supportTicketRoutes = require("../customer/routes/supportTicket.routes");
const garageMediaRoutes = require("./garageMedia.routes");
const walletRoutes = require("../customer/routes/wallet.routes");
const garageWalletRoutes = require("./garageWallet.routes");
const newGarageWalletRoutes = require("../garage/routes/wallet.routes");
const garageRequestRoutes = require("./garageRequest.routes");
const serviceMediaRoutes = require("../customer/routes/serviceMedia.routes");
const sosRoutes = require("../customer/routes/sos.routes");
const contactRoutes = require("../customer/routes/contact.routes");
const whatsappRoutes = require("./whatsapp.routes");
const dashboardRoutes = require("../customer/routes/dashboard.routes");
const chatbotRoutes = require("../customer/routes/chatbot.routes");
const activityRoutes = require("../customer/routes/activity.routes");
const publicRoutes = require("./public.routes");
const pushRoutes = require("./push.routes");
const cityRoutes = require("./city.routes");
const systemIssueReportRoutes = require("./systemIssue.routes");
const mapsRoutes = require("../maps/routes/maps.routes");
const adminGarageApplicationRoutes = require("../admin/routes/garageApplication.routes");
const cityServicePriceRangeRoutes = require("../admin/routes/cityServicePriceRange.routes");
const adminGarageRoutes = require("../admin/routes/garageAdmin.routes");
const adminOperationsRoutes = require("../admin/routes/adminOperations.routes");
const adminCarMetaRoutes = require("../admin/routes/carMeta.routes");
const adminServiceRoutes = require("../admin/routes/serviceAdmin.routes");
const adminSystemIssueRoutes = require("../admin/routes/systemIssue.routes");
const adminDangerousRoutes = require("../admin/routes/dangerous.routes");
const adminSupportRoutes = require("../admin/routes/adminSupport.routes");
const customerSupportAccountRoutes = require("../admin/routes/customerSupportAccount.routes");
const internAccountRoutes = require("../admin/routes/internAccount.routes");
const customerSupportRoutes = require("../customerSupport/routes/customerSupport.routes");
const authController = require("../customer/controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const rateLimit = require("../middlewares/rateLimit.middleware");
const {
  protectUser,
} = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const {
  otpSendRateLimits,
} = require("../middlewares/otpRateLimit.middleware");
const {
  sendPhoneOtpValidation,
  verifyPhoneOtpValidation,
} = require("../customer/validations/auth.validation");

const router = express.Router();

const publicOtpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  fallbackMax: 4,
  keyGenerator: (req) => `${req.ip}:${req.body?.phone || "otp"}`,
});

router.use("/auth", authRoutes);
router.use("/public", publicRoutes);
router.use("/system-issues", systemIssueReportRoutes);
router.use("/cities", cityRoutes);
router.use("/maps", mapsRoutes);
router.use("/push", pushRoutes);
router.use("/customer-support", customerSupportRoutes);

router.post(
  "/send-otp",
  sendPhoneOtpValidation,
  validate,
  otpSendRateLimits,
  publicOtpRateLimit,
  authController.sendPhoneOtp,
);

router.post(
  "/verify-otp",
  publicOtpRateLimit,
  verifyPhoneOtpValidation,
  validate,
  authController.verifyPhoneOtp,
);

/*
 * Customer-only route groups.
 * protectUser rejects staff sessions, then authorizeRoles("CUSTOMER") rejects
 * garage-owner user sessions so role-specific data cannot mix.
 */
const requireCustomer = authorizeRoles("CUSTOMER");

router.use("/customer", protectUser, requireCustomer, customerRoutes);
router.use("/vehicles", protectUser, requireCustomer, vehicleRoutes);
router.use("/locations", protectUser, requireCustomer, locationRoutes);
router.use("/notifications", protectUser, requireCustomer, notificationRoutes);
router.use("/bookings", protectUser, requireCustomer, bookingRoutes);
router.use("/payments", protectUser, requireCustomer, paymentRoutes);
router.use("/complaints", protectUser, requireCustomer, complaintRoutes);
router.use("/support-tickets", protectUser, requireCustomer, supportTicketRoutes);
router.use("/dashboard", protectUser, requireCustomer, dashboardRoutes);
router.use("/chatbot", protectUser, requireCustomer, chatbotRoutes);
router.use("/activities", protectUser, requireCustomer, activityRoutes);
router.use("/wallet", protectUser, requireCustomer, walletRoutes);
router.use("/sos", protectUser, requireCustomer, sosRoutes);

/*
 * Public or mixed route groups keep their own route-level authorization.
 */
router.use("/contact", contactRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/webhooks/whatsapp", whatsappRoutes);
router.use("/webhooks/cashfree", paymentWebhookRoutes);
router.use("/services", serviceRoutes);
router.use("/services", serviceMediaRoutes);
router.use("/vehicle-meta", vehicleMetaRoutes);
router.use("/garages", garageRoutes);
router.use("/garage/applications", garageApplicationRoutes);
router.use("/garages", garageMediaRoutes);
router.use("/reviews", reviewRoutes);
router.use("/garage/wallet", newGarageWalletRoutes);
router.use("/garage/wallet-legacy", garageWalletRoutes);
router.use("/garage/requests", garageRequestRoutes);

/*
 * Admin and intern route modules already use protect plus role authorization.
 * protect now resolves staff accounts from StaffAccount.
 */
router.use(
  "/admin/garage-applications",
  adminGarageApplicationRoutes,
);
router.use(
  "/admin/city-service-price-ranges",
  cityServicePriceRangeRoutes,
);
router.use("/admin/cars", adminCarMetaRoutes);
router.use("/admin/services", adminServiceRoutes);
router.use("/admin/system-issues", adminSystemIssueRoutes);
router.use("/admin/dangerous", adminDangerousRoutes);
router.use("/admin/customer-support-accounts", customerSupportAccountRoutes);
router.use("/admin/intern-accounts", internAccountRoutes);
router.use("/admin/support-tickets", adminSupportRoutes);
router.use("/admin/garages", adminGarageRoutes);
router.use("/admin", adminOperationsRoutes);

module.exports = router;
