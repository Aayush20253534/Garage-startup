const normalizeCapabilityValue = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeServiceIds = (serviceIds = []) => [
  ...new Set(
    (Array.isArray(serviceIds) ? serviceIds : [])
      .map((serviceId) => String(serviceId || "").trim())
      .filter(Boolean),
  ),
];

const parseBrandList = (value) => {
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

const garageExcludesVehicleBrand = (garage, vehicle = {}) => {
  const vehicleBrand = normalizeCapabilityValue(vehicle.brand);
  if (!vehicleBrand) return false;

  const excludedBrands = parseBrandList(garage?.excludedServiceBrands)
    .map(normalizeCapabilityValue)
    .filter(Boolean);

  return excludedBrands.includes(vehicleBrand);
};

const garageSupportsVehicleBrand = (garage, vehicle = {}) => {
  const vehicleBrand = normalizeCapabilityValue(vehicle.brand);
  if (!vehicleBrand) return false;

  if (garageExcludesVehicleBrand(garage, vehicle)) return false;

  const supportedBrands = parseBrandList(garage?.supportedBrands)
    .map(normalizeCapabilityValue)
    .filter(Boolean);

  return supportedBrands.includes("all") || supportedBrands.includes(vehicleBrand);
};

const assignmentScopeMatchesVehicle = (assignment, vehicle = {}) => {
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

const assignmentMatchesVehicle = (assignment, vehicle = {}) =>
  assignment?.isExcluded !== true &&
  assignmentScopeMatchesVehicle(assignment, vehicle);

const assignmentExcludesVehicle = (assignment, vehicle = {}) =>
  assignment?.isExcluded === true &&
  assignmentScopeMatchesVehicle(assignment, vehicle);

const garageCanServeBooking = ({ garage, serviceIds = [], vehicle = {} }) => {
  const requiredServiceIds = normalizeServiceIds(serviceIds);
  const assignments = Array.isArray(garage?.services) ? garage.services : [];

  if (!requiredServiceIds.length || !garageSupportsVehicleBrand(garage, vehicle)) {
    return false;
  }

  return requiredServiceIds.every((serviceId) => {
    const serviceAssignments = assignments.filter(
      (assignment) =>
        assignment.serviceId === serviceId && assignment.isActive !== false,
    );

    const isProvided = serviceAssignments.some((assignment) =>
      assignmentMatchesVehicle(assignment, vehicle),
    );
    const isExcluded = serviceAssignments.some((assignment) =>
      assignmentExcludesVehicle(assignment, vehicle),
    );

    return isProvided && !isExcluded;
  });
};

module.exports = {
  assignmentExcludesVehicle,
  assignmentMatchesVehicle,
  garageCanServeBooking,
  garageExcludesVehicleBrand,
  garageSupportsVehicleBrand,
};
