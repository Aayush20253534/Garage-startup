const express = require("express");
const controller = require("../controllers/maps.controller");
const validate = require("../../middlewares/validate.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");
const { protect } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const {
  addressValidation,
  autocompleteValidation,
  bookingIdValidation,
  optimizationValidation,
  placeDetailsValidation,
  roadsValidation,
  routeMatrixValidation,
  routeValidation,
  trackingPointValidation,
} = require("../validations/maps.validation");

const router = express.Router();

const publicPlacesLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  fallbackMax: 8,
  keyGenerator: (req) => `maps-places:${req.ip}`,
});

const routeLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `maps-routes:${req.user?.id || req.ip}`,
});

router.get("/config", controller.getConfig);
router.post(
  "/autocomplete",
  publicPlacesLimit,
  autocompleteValidation,
  validate,
  controller.autocomplete,
);
router.post(
  "/validate-address",
  publicPlacesLimit,
  addressValidation,
  validate,
  controller.validateAddress,
);

router.get(
  "/places/:placeId",
  publicPlacesLimit,
  placeDetailsValidation,
  validate,
  controller.placeDetails,
);

router.use(protect);

router.post(
  "/route",
  routeLimit,
  routeValidation,
  validate,
  controller.computeRoute,
);
router.post(
  "/route-matrix",
  routeLimit,
  routeMatrixValidation,
  validate,
  controller.computeRouteMatrix,
);
router.post(
  "/roads/snap",
  routeLimit,
  roadsValidation,
  validate,
  controller.snapToRoads,
);

router.get(
  "/bookings/:bookingId/tracking",
  bookingIdValidation,
  validate,
  controller.getBookingTracking,
);
router.post(
  "/bookings/:bookingId/tracking/start",
  authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER", "ADMIN"),
  bookingIdValidation,
  validate,
  controller.startBookingTracking,
);
router.post(
  "/bookings/:bookingId/tracking/location",
  authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER", "ADMIN"),
  trackingPointValidation,
  validate,
  controller.addBookingTrackingPoint,
);
router.post(
  "/bookings/:bookingId/tracking/stop",
  authorizeRoles("GARAGE_OWNER", "GARAGE_CONTROLLER", "ADMIN"),
  bookingIdValidation,
  validate,
  controller.stopBookingTracking,
);

router.post(
  "/optimize-routes",
  authorizeRoles("ADMIN"),
  optimizationValidation,
  validate,
  controller.optimizeActiveRoutes,
);

module.exports = router;
