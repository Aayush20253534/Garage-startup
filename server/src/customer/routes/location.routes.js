const express = require("express");

const locationController = require("../controllers/location.controller");
const { protectUser } = require("../../middlewares/auth.middleware");
const { authorizeRoles } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const rateLimit = require("../../middlewares/rateLimit.middleware");

const {
  locationIdValidation,
  createLocationValidation,
  updateLocationValidation,
  geocodeLocationValidation,
  reverseGeocodeLocationValidation,
} = require("../validations/location.validation");

const router = express.Router();

// Reverse geocoding is also needed before customer signup and during public
// garage onboarding. The Google key stays on the server, while this proxy is
// constrained by an IP-based rate limit.
const publicReverseGeocodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `reverse-geocode:${req.ip}`,
});

router.get(
  "/reverse-geocode",
  publicReverseGeocodeRateLimit,
  reverseGeocodeLocationValidation,
  validate,
  locationController.reverseGeocodeLocation,
);

router.use(protectUser, authorizeRoles("CUSTOMER"));

// Forward geocoding is billed per request. Keep this conservative and scoped
// to an authenticated customer account.
const geocodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `geocode:${req.user.id}`,
});

router.get(
  "/geocode",
  geocodeRateLimit,
  geocodeLocationValidation,
  validate,
  locationController.geocodeLocation,
);

router
  .route("/")
  .post(createLocationValidation, validate, locationController.createLocation)
  .get(locationController.getMyLocations);

router.patch(
  "/:id/default",
  locationIdValidation,
  validate,
  locationController.setDefaultLocation,
);

router
  .route("/:id")
  .get(locationIdValidation, validate, locationController.getLocationById)
  .patch(updateLocationValidation, validate, locationController.updateLocation)
  .delete(locationIdValidation, validate, locationController.deleteLocation);

module.exports = router;
