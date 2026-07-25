const FUEL_TYPES = [
  "PETROL",
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
  "CNG",
  "OTHER",
];

const normalizeText = (value) => String(value || "").trim();
const normalizeComparable = (value) => normalizeText(value).toLowerCase();
const normalizeScopeValue = (value) => {
  const text = normalizeText(value);
  return !text || ["ALL", "ANY"].includes(text.toUpperCase()) ? null : text;
};

const clampLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 250;
  return Math.min(1000, Math.max(10, parsed));
};

const sortByLabel = (items = [], selector) =>
  [...items].sort((left, right) =>
    String(selector(left) || "").localeCompare(String(selector(right) || ""), undefined, {
      sensitivity: "base",
    }),
  );

const getVehicleFuelKey = (brand, model) =>
  `${normalizeComparable(brand)}|${normalizeComparable(model)}`;

const rangeCoversScope = (range, scope) => {
  if (normalizeComparable(range.city) !== normalizeComparable(scope.city)) return false;
  if (range.serviceId !== scope.serviceId) return false;

  const rangeBrand = normalizeScopeValue(range.vehicleBrand);
  if (
    rangeBrand &&
    normalizeComparable(rangeBrand) !== normalizeComparable(scope.vehicleBrand)
  ) {
    return false;
  }

  const rangeModel = normalizeScopeValue(range.vehicleModel);
  if (
    rangeModel &&
    normalizeComparable(rangeModel) !== normalizeComparable(scope.vehicleModel)
  ) {
    return false;
  }

  if (range.fuelType && range.fuelType !== scope.fuelType) return false;
  return true;
};

const filterMatches = (scope, query = {}) => {
  if (query.city && normalizeComparable(query.city) !== normalizeComparable(scope.city)) {
    return false;
  }
  if (query.serviceId && query.serviceId !== scope.serviceId) return false;
  if (
    query.vehicleBrand &&
    normalizeComparable(query.vehicleBrand) !== normalizeComparable(scope.vehicleBrand)
  ) {
    return false;
  }
  if (
    query.fuelType &&
    normalizeText(query.fuelType).toUpperCase() !== scope.fuelType
  ) {
    return false;
  }
  return true;
};

const buildPricingCoverageReport = (
  {
    cities = [],
    services = [],
    brands = [],
    ranges = [],
    vehicleFuelScopes = [],
  } = {},
  query = {},
) => {
  const limit = clampLimit(query.limit);
  const activeRanges = ranges.filter((range) => range.isActive !== false);
  const sortedCities = sortByLabel(cities, (city) => city.name);
  const sortedServices = sortByLabel(services, (service) =>
    `${service.category?.name || ""} ${service.name}`,
  );
  const sortedBrands = sortByLabel(brands, (brand) => brand.name).map((brand) => ({
    ...brand,
    models: sortByLabel(
      (brand.models || []).filter((model) => model.isActive !== false),
      (model) => model.name,
    ),
  }));

  const rangesByCityService = new Map();
  const serviceIdsWithAnyRange = new Set();
  const observedFuelTypesByModel = new Map();

  vehicleFuelScopes.forEach((scope) => {
    if (!scope.brand || !scope.model || !FUEL_TYPES.includes(scope.fuelType)) return;
    const key = getVehicleFuelKey(scope.brand, scope.model);
    const fuels = observedFuelTypesByModel.get(key) || new Set();
    fuels.add(scope.fuelType);
    observedFuelTypesByModel.set(key, fuels);
  });

  const getModelFuelTypes = (brand, model) => {
    const observed = observedFuelTypesByModel.get(getVehicleFuelKey(brand, model));
    if (!observed?.size) return FUEL_TYPES;
    return FUEL_TYPES.filter((fuelType) => observed.has(fuelType));
  };

  activeRanges.forEach((range) => {
    serviceIdsWithAnyRange.add(range.serviceId);
    const key = `${normalizeComparable(range.city)}|${range.serviceId}`;
    const bucket = rangesByCityService.get(key) || [];
    bucket.push(range);
    rangesByCityService.set(key, bucket);
  });

  const untouchedServices = sortedServices
    .filter((service) => !serviceIdsWithAnyRange.has(service.id))
    .map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category?.name || "Uncategorised",
    }));

  const missingCityServices = [];
  sortedCities.forEach((city) => {
    sortedServices.forEach((service) => {
      const key = `${normalizeComparable(city.normalizedName || city.name)}|${service.id}`;
      if (!rangesByCityService.has(key)) {
        missingCityServices.push({
          city: city.name,
          serviceId: service.id,
          serviceName: service.name,
          category: service.category?.name || "Uncategorised",
        });
      }
    });
  });

  let totalModelFuelScopes = 0;
  let modelFuelGapCount = 0;
  let brandFuelGapCount = 0;
  let filteredModelFuelGapCount = 0;
  let filteredBrandFuelGapCount = 0;
  const modelFuelGaps = [];
  const brandFuelGaps = [];

  sortedCities.forEach((city) => {
    const cityKey = normalizeComparable(city.normalizedName || city.name);

    sortedServices.forEach((service) => {
      const relevantRanges = rangesByCityService.get(`${cityKey}|${service.id}`) || [];

      sortedBrands.forEach((brand) => {
        if (!brand.models.length) return;

        const fuelTypesByModel = new Map(
          brand.models.map((model) => [
            model.id,
            getModelFuelTypes(brand.name, model.name),
          ]),
        );
        const brandFuelTypes = FUEL_TYPES.filter((fuelType) =>
          brand.models.some((model) =>
            fuelTypesByModel.get(model.id).includes(fuelType),
          ),
        );

        brandFuelTypes.forEach((fuelType) => {
          let missingModels = 0;
          let eligibleModels = 0;

          brand.models.forEach((model) => {
            if (!fuelTypesByModel.get(model.id).includes(fuelType)) return;
            eligibleModels += 1;
            totalModelFuelScopes += 1;
            const scope = {
              city: city.name,
              serviceId: service.id,
              vehicleBrand: brand.name,
              vehicleModel: model.name,
              fuelType,
            };
            const covered = relevantRanges.some((range) =>
              rangeCoversScope(range, scope),
            );

            if (covered) return;
            modelFuelGapCount += 1;
            missingModels += 1;

            if (filterMatches(scope, query)) {
              filteredModelFuelGapCount += 1;
              if (modelFuelGaps.length < limit) {
                modelFuelGaps.push({
                  ...scope,
                  serviceName: service.name,
                  category: service.category?.name || "Uncategorised",
                });
              }
            }
          });

          if (missingModels === 0) return;
          brandFuelGapCount += 1;
          const brandScope = {
            city: city.name,
            serviceId: service.id,
            vehicleBrand: brand.name,
            fuelType,
          };
          if (filterMatches(brandScope, query)) {
            filteredBrandFuelGapCount += 1;
            if (brandFuelGaps.length < limit) {
              brandFuelGaps.push({
                ...brandScope,
                serviceName: service.name,
                category: service.category?.name || "Uncategorised",
                missingModels,
                totalModels: eligibleModels,
              });
            }
          }
        });
      });
    });
  });

  return {
    totals: {
      activeRanges: activeRanges.length,
      activeCities: sortedCities.length,
      activeServices: sortedServices.length,
      activeBrands: sortedBrands.length,
      activeModels: sortedBrands.reduce((sum, brand) => sum + brand.models.length, 0),
      untouchedServices: untouchedServices.length,
      missingCityServicePairs: missingCityServices.length,
      brandFuelGaps: brandFuelGapCount,
      modelFuelGaps: modelFuelGapCount,
      coveredModelFuelScopes: Math.max(0, totalModelFuelScopes - modelFuelGapCount),
      totalModelFuelScopes,
    },
    filters: {
      cities: sortedCities.map((city) => city.name),
      services: sortedServices.map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category?.name || "Uncategorised",
      })),
      brands: sortedBrands.map((brand) => brand.name),
      fuelTypes: FUEL_TYPES,
      fuelCoverageBasis:
        observedFuelTypesByModel.size > 0
          ? "REGISTERED_VEHICLES_WITH_ALL_FUELS_FALLBACK"
          : "ALL_SUPPORTED_FUELS",
    },
    appliedFilters: {
      city: normalizeText(query.city),
      serviceId: normalizeText(query.serviceId),
      vehicleBrand: normalizeText(query.vehicleBrand),
      fuelType: normalizeText(query.fuelType).toUpperCase(),
      limit,
    },
    resultMeta: {
      limit,
      filteredModelFuelGapCount,
      filteredBrandFuelGapCount,
      returnedModelFuelGaps: modelFuelGaps.length,
      returnedBrandFuelGaps: brandFuelGaps.length,
      modelResultsTruncated: modelFuelGaps.length < filteredModelFuelGapCount,
      brandResultsTruncated: brandFuelGaps.length < filteredBrandFuelGapCount,
    },
    untouchedServices,
    missingCityServices,
    brandFuelGaps,
    modelFuelGaps,
  };
};

module.exports = {
  FUEL_TYPES,
  buildPricingCoverageReport,
  rangeCoversScope,
};
