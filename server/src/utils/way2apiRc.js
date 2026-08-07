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
  // Way2API can return the complete registered owner name. Rovauto only keeps
  // and returns a masked form because ownership verification is not required
  // for the booking flow and the raw name is unnecessary PII.
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

module.exports = {
  maskOwnerName,
  parseWay2ApiVehicle,
};
