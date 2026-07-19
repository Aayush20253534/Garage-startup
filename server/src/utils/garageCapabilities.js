const normalizeCapabilityValue = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeServiceIds = (serviceIds = []) => [
  ...new Set(
    (Array.isArray(serviceIds) ? serviceIds : [])
      .map((serviceId) => String(serviceId || "").trim())
      .filter(Boolean),
  ),
];

const parseSupportedBrands = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Legacy records may contain comma-separated brand names.
  }

  return String(value).split(",");
};

const garageSupportsVehicleBrand = (garage, vehicle = {}) => {
  const vehicleBrand = normalizeCapabilityValue(vehicle.brand);
  if (!vehicleBrand) return false;

  const supportedBrands = parseSupportedBrands(garage?.supportedBrands)
    .map(normalizeCapabilityValue)
    .filter(Boolean);

  return supportedBrands.includes("all") || supportedBrands.includes(vehicleBrand);
};

const assignmentMatchesVehicle = (assignment, vehicle = {}) => {
  if (!assignment || assignment.isActive === false) return false;
  if (assignment.service?.isActive === false) return false;
  if (assignment.service?.category?.isActive === false) return false;

  const assignedBrand = normalizeCapabilityValue(
    assignment.vehicleBrand || "ALL",
  );
  const assignedModel = normalizeCapabilityValue(
    assignment.vehicleModel || "ALL",
  );
  const vehicleBrand = normalizeCapabilityValue(vehicle.brand);
  const vehicleModel = normalizeCapabilityValue(vehicle.model);

  const brandMatches =
    assignedBrand === "all" ||
    (vehicleBrand && assignedBrand === vehicleBrand);
  const modelMatches =
    assignedModel === "all" ||
    (vehicleModel && assignedModel === vehicleModel);

  return Boolean(brandMatches && modelMatches);
};

const garageCanServeBooking = ({ garage, serviceIds = [], vehicle = {} }) => {
  const requiredServiceIds = normalizeServiceIds(serviceIds);
  const assignments = Array.isArray(garage?.services) ? garage.services : [];

  if (!requiredServiceIds.length || !garageSupportsVehicleBrand(garage, vehicle)) {
    return false;
  }

  return requiredServiceIds.every((serviceId) =>
    assignments.some(
      (assignment) =>
        assignment.serviceId === serviceId &&
        assignmentMatchesVehicle(assignment, vehicle),
    ),
  );
};

module.exports = {
  assignmentMatchesVehicle,
  garageCanServeBooking,
  garageSupportsVehicleBrand,
};
