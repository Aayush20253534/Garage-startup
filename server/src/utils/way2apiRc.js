const { normalizeRegistrationNumber } = require("./vehicleRegistration");

const clean = (value) => String(value || "").trim();

const maskOwnerName = (value) =>
  clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 1) return "*";
      if (part.length === 2) return `${part[0]}*`;
      const middleLength = Math.min(3, Math.max(1, part.length - 2));
      return `${part[0]}${"*".repeat(middleLength)}${part[part.length - 1]}`;
    })
    .join(" ") || null;

const parseWay2ApiVehicle = (result = {}) => ({
  registrationNumber: normalizeRegistrationNumber(result.rc_number),
  // Keep the full provider owner name server-side for admin records while
  // preserving the masked variant for customer-facing verification UI.
  ownerName: clean(result.owner_name) || null,
  ownerNameMasked: maskOwnerName(result.owner_name),
  maker: clean(result.maker_description) || null,
  model: clean(result.maker_model) || null,
  fuelType: clean(result.fuel_type) || null,
  vehicleClass: clean(result.vehicle_category) || null,
  status: clean(result.rc_status) || null,
  registrationDate: clean(result.registration_date) || null,
  insuranceUpto: clean(result.insurance_upto) || null,
  blacklistStatus: clean(result.blacklist_status) || null,
});

// Admin live lookup may display the provider-returned RC owner name, but this
// shape still intentionally excludes addresses, chassis/engine numbers, policy
// numbers and other RC fields that are not needed for support operations.
const parseWay2ApiAdminVehicle = (result = {}) => ({
  registrationNumber: normalizeRegistrationNumber(result.rc_number),
  ownerName: clean(result.owner_name) || null,
  maker: clean(result.maker_description) || null,
  model: clean(result.maker_model) || null,
  fuelType: clean(result.fuel_type) || null,
  vehicleClass: clean(result.vehicle_category) || null,
  status: clean(result.rc_status) || null,
  registrationDate: clean(result.registration_date) || null,
  registeredAt: clean(result.registered_at) || null,
  insuranceUpto: clean(result.insurance_upto) || null,
});

module.exports = {
  maskOwnerName,
  parseWay2ApiVehicle,
  parseWay2ApiAdminVehicle,
};
