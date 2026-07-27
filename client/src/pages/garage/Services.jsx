import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiFilter,
  FiLayers,
  FiLock,
  FiRefreshCw,
  FiTag,
  FiTool,
} from "react-icons/fi";
import api from "@/api/axios";
import SafeImage from "@/components/common/SafeImage";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import { CATEGORY_UI } from "@/data/services";
import { setServices } from "@/store/garageSlice";
import {
  getOptimizedImageUrl,
  getServiceThumbnailUrl,
} from "@/utils/imageCache";
import { formatRupeeRange } from "@/utils/priceRange";

const FUEL_TYPES = [
  { value: "", label: "Any fuel type" },
  { value: "PETROL", label: "Petrol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "ELECTRIC", label: "Electric" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "CNG", label: "CNG" },
  { value: "OTHER", label: "Other" },
];

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const normalizeBrands = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Older garage records may use a comma-separated value.
  }

  return String(value)
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
};

const normalizeComparable = (value) => String(value || "").trim().toLowerCase();

const assignmentScopeMatches = (assignment, brand, model) => {
  const assignmentBrand = normalizeComparable(assignment?.vehicleBrand || "ALL");
  const assignmentModel = normalizeComparable(assignment?.vehicleModel || "ALL");
  const normalizedBrand = normalizeComparable(brand);
  const normalizedModel = normalizeComparable(model);

  return (
    (assignmentBrand === "all" || assignmentBrand === normalizedBrand) &&
    (assignmentModel === "all" || assignmentModel === normalizedModel)
  );
};

const garageServesVehicleModel = (assignments, brand, model) => {
  const grouped = new Map();

  assignments.forEach((assignment) => {
    if (!assignment?.serviceId) return;
    const current = grouped.get(assignment.serviceId) || [];
    current.push(assignment);
    grouped.set(assignment.serviceId, current);
  });

  return [...grouped.values()].some((serviceAssignments) => {
    const included = serviceAssignments.some(
      (assignment) =>
        assignment.isExcluded !== true &&
        assignmentScopeMatches(assignment, brand, model),
    );
    const excluded = serviceAssignments.some(
      (assignment) =>
        assignment.isExcluded === true &&
        assignmentScopeMatches(assignment, brand, model),
    );
    return included && !excluded;
  });
};

const getAssignmentLabel = ({ vehicleBrand, vehicleModel }) => {
  const brand =
    vehicleBrand && vehicleBrand !== "ALL"
      ? vehicleBrand
      : "All supported brands";

  return vehicleModel && vehicleModel !== "ALL"
    ? `${brand} · ${vehicleModel}`
    : brand;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-bg-soft disabled:text-muted";

export default function GarageServices() {
  const { services, garage } = useSelector((state) => state.garage);
  const dispatch = useDispatch();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [vehicleCatalog, setVehicleCatalog] = useState([]);
  const [coverageAssignments, setCoverageAssignments] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedFuelType, setSelectedFuelType] = useState("");

  const safeAssignments = useMemo(
    () => (Array.isArray(services) ? services : []),
    [services],
  );
  const supportedBrands = useMemo(
    () => normalizeBrands(garage?.supportedBrands),
    [garage?.supportedBrands],
  );
  const excludedServiceBrands = useMemo(
    () => normalizeBrands(garage?.excludedServiceBrands),
    [garage?.excludedServiceBrands],
  );

  const cateredBrandOptions = useMemo(() => {
    const supportedSet = new Set(supportedBrands.map(normalizeComparable));
    const excludedSet = new Set(excludedServiceBrands.map(normalizeComparable));
    const supportsAll = supportedSet.has("all");
    const catalogByName = new Map(
      vehicleCatalog.map((brand) => [normalizeComparable(brand.name), brand]),
    );

    const fromCatalog = vehicleCatalog.filter((brand) => {
      const normalizedName = normalizeComparable(brand.name);
      return (
        !excludedSet.has(normalizedName) &&
        (supportsAll || supportedSet.has(normalizedName))
      );
    });

    const missingConfiguredBrands = supportedBrands
      .filter((brand) => normalizeComparable(brand) !== "all")
      .filter((brand) => !excludedSet.has(normalizeComparable(brand)))
      .filter((brand) => !catalogByName.has(normalizeComparable(brand)))
      .map((brand) => ({ id: `configured:${brand}`, name: brand, models: [] }));

    return [...fromCatalog, ...missingConfiguredBrands].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [vehicleCatalog, supportedBrands, excludedServiceBrands]);

  const selectedBrandRecord = useMemo(
    () =>
      cateredBrandOptions.find(
        (brand) => normalizeComparable(brand.name) === normalizeComparable(selectedBrand),
      ) || null,
    [cateredBrandOptions, selectedBrand],
  );

  const modelOptions = useMemo(() => {
    if (!selectedBrand) return [];

    const catalogModels = Array.isArray(selectedBrandRecord?.models)
      ? selectedBrandRecord.models
      : [];
    const configuredModelNames = coverageAssignments
      .filter(
        (assignment) =>
          normalizeComparable(assignment?.vehicleBrand || "ALL") === "all" ||
          normalizeComparable(assignment?.vehicleBrand) ===
            normalizeComparable(selectedBrand),
      )
      .map((assignment) => assignment?.vehicleModel)
      .filter((model) => model && normalizeComparable(model) !== "all");
    const candidateByName = new Map(
      catalogModels.map((model) => [normalizeComparable(model.name), model]),
    );
    configuredModelNames.forEach((name) => {
      const key = normalizeComparable(name);
      if (!candidateByName.has(key)) {
        candidateByName.set(key, {
          id: `configured:${selectedBrand}:${name}`,
          name,
        });
      }
    });

    return [...candidateByName.values()]
      .filter((model) =>
        garageServesVehicleModel(
          coverageAssignments,
          selectedBrand,
          model.name,
        ),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [coverageAssignments, selectedBrand, selectedBrandRecord]);

  const selectedModelRecord = useMemo(
    () =>
      modelOptions.find(
        (model) =>
          normalizeComparable(model.name) === normalizeComparable(selectedModel),
      ) || null,
    [modelOptions, selectedModel],
  );

  const assignedServices = useMemo(() => {
    const grouped = new Map();

    safeAssignments.forEach((assignment) => {
      const service = assignment?.service;
      if (!assignment?.id || !service?.id) return;

      if (!grouped.has(service.id)) {
        grouped.set(service.id, {
          service,
          assignments: [],
          matchedVehicle: assignment.matchedVehicle || null,
        });
      }

      const vehicleBrand = assignment.vehicleBrand || "ALL";
      const vehicleModel = assignment.vehicleModel || "ALL";
      const isExcluded = assignment.isExcluded === true;
      const scopeKey = `${isExcluded ? "exclude" : "include"}:${vehicleBrand.toLowerCase()}:${vehicleModel.toLowerCase()}`;
      const group = grouped.get(service.id);

      if (!group.assignments.some((item) => item.scopeKey === scopeKey)) {
        group.assignments.push({
          vehicleBrand,
          vehicleModel,
          isExcluded,
          scopeKey,
        });
      }
    });

    return [...grouped.values()].sort((left, right) => {
      const leftCategory = left.service.category?.name || "";
      const rightCategory = right.service.category?.name || "";
      return (
        leftCategory.localeCompare(rightCategory) ||
        left.service.name.localeCompare(right.service.name)
      );
    });
  }, [safeAssignments]);

  const loadVehicleCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await api.get("/vehicle-meta/brands");
      setVehicleCatalog(
        Array.isArray(response.data?.data) ? response.data.data : [],
      );
    } catch (err) {
      setVehicleCatalog([]);
      setError(
        err.response?.data?.message || "Unable to load vehicle brand filters",
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadCoverageAssignments = useCallback(async () => {
    if (!garage?.id) {
      setCoverageAssignments([]);
      return;
    }

    try {
      const response = await api.get("/garages/me/services");
      setCoverageAssignments(
        Array.isArray(response.data?.data) ? response.data.data : [],
      );
    } catch (err) {
      setCoverageAssignments([]);
      if (err.response?.status !== 404 && err.response?.status !== 403) {
        setError(
          err.response?.data?.message || "Unable to load vehicle coverage rules",
        );
      }
    }
  }, [garage?.id]);

  const loadServices = useCallback(async () => {
    if (!garage?.id) {
      dispatch(setServices([]));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get("/garages/me/services", {
        params: {
          ...(selectedBrand ? { vehicleBrand: selectedBrand } : {}),
          ...(selectedModel ? { vehicleModel: selectedModel } : {}),
          ...(selectedFuelType ? { fuelType: selectedFuelType } : {}),
        },
      });
      dispatch(
        setServices(Array.isArray(response.data?.data) ? response.data.data : []),
      );
    } catch (err) {
      dispatch(setServices([]));
      if (err.response?.status !== 404 && err.response?.status !== 403) {
        setError(
          err.response?.data?.message || "Unable to load assigned services",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [garage?.id, dispatch, selectedBrand, selectedModel, selectedFuelType]);

  useEffect(() => {
    loadVehicleCatalog();
  }, [loadVehicleCatalog]);

  useEffect(() => {
    loadCoverageAssignments();
  }, [loadCoverageAssignments]);

  useEffect(() => {
    if (!selectedBrand && cateredBrandOptions.length > 0) {
      setSelectedBrand(cateredBrandOptions[0].name);
    }
  }, [cateredBrandOptions, selectedBrand]);

  useEffect(() => {
    if (
      selectedModel &&
      !modelOptions.some(
        (model) => normalizeComparable(model.name) === normalizeComparable(selectedModel),
      )
    ) {
      setSelectedModel("");
    }
  }, [modelOptions, selectedModel]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const selectedVehicleLabel = [
    selectedBrand,
    selectedModel || (selectedBrand ? "All models" : ""),
    selectedFuelType
      ? FUEL_TYPES.find((item) => item.value === selectedFuelType)?.label
      : "Any fuel",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-bg-soft/30">
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  Assigned services
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border border-line bg-bg-soft px-2.5 py-1 text-xs font-semibold text-muted">
                  <FiLock className="h-3 w-3" />
                  Managed by admin
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Select a vehicle your garage caters to. The list then shows only
                matching service allocations and the active customer price range
                for your garage city.
              </p>
            </div>

            <button
              type="button"
              onClick={loadServices}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && supportedBrands.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Brand coverage is missing</p>
              <p className="mt-1 leading-5">
                Add the brands your garage services in the garage profile. No
                booking alert is sent until the customer vehicle brand matches.
              </p>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiFilter />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-ink">Vehicle coverage filter</h2>
              <p className="mt-1 text-sm leading-5 text-muted">
                Brands are limited to this garage&apos;s configured coverage. Model
                and fuel type are used to resolve the exact active price range.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  Brand
                  <select
                    value={selectedBrand}
                    onChange={(event) => {
                      setSelectedBrand(event.target.value);
                      setSelectedModel("");
                    }}
                    disabled={catalogLoading || cateredBrandOptions.length === 0}
                    className={fieldClass}
                  >
                    {cateredBrandOptions.length === 0 && (
                      <option value="">No catered brands configured</option>
                    )}
                    {cateredBrandOptions.map((brand) => (
                      <option key={brand.id || brand.name} value={brand.name}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  Model
                  <select
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    disabled={!selectedBrand || catalogLoading}
                    className={fieldClass}
                  >
                    <option value="">All catered models</option>
                    {modelOptions.map((model) => (
                      <option key={model.id || model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  Fuel type
                  <select
                    value={selectedFuelType}
                    onChange={(event) => setSelectedFuelType(event.target.value)}
                    disabled={!selectedBrand}
                    className={fieldClass}
                  >
                    {FUEL_TYPES.map((fuel) => (
                      <option key={fuel.value || "ANY"} value={fuel.value}>
                        {fuel.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedVehicleLabel && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-bg-soft p-2.5">
                  {selectedModelRecord && (
                    <SafeImage
                      src={getOptimizedImageUrl(selectedModelRecord.imageUrl, {
                        width: 180,
                      })}
                      alt={`${selectedBrand} ${selectedModelRecord.name}`}
                      width="180"
                      height="112"
                      loading="lazy"
                      className="h-14 w-20 shrink-0 rounded-md bg-white object-cover"
                      fallback={
                        <div className="grid h-14 w-20 shrink-0 place-items-center rounded-md bg-white text-xl text-muted">
                          <FiTag />
                        </div>
                      }
                    />
                  )}
                  <p className="min-w-0 text-xs font-semibold text-ink">
                    Showing eligibility and pricing for {selectedVehicleLabel}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiTool />
            </span>
            <p className="mt-4 text-2xl font-bold text-ink">{assignedServices.length}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Matching services</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiLayers />
            </span>
            <p className="mt-4 text-2xl font-bold text-ink">{safeAssignments.length}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Allocation rules</p>
          </div>
          <div className="col-span-2 rounded-xl border border-line bg-white p-4 shadow-sm sm:col-span-1">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiTag />
            </span>
            <p className="mt-4 text-2xl font-bold text-ink">{cateredBrandOptions.length}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Catered brands</p>
          </div>
        </section>

        {excludedServiceBrands.length > 0 && (
          <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
                <FiLock className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Garage-wide excluded brands</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  These brands never receive service requests or booking alerts
                  for this garage, even when an allocation covers all vehicles.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {excludedServiceBrands.map((brand) => (
                    <span
                      key={brand}
                      className="rounded-md border border-line bg-bg-soft px-2.5 py-1.5 text-xs font-semibold text-ink"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-4 text-sm text-muted shadow-sm">
              <FiRefreshCw className="h-4 w-4 animate-spin" />
              Loading matching services and price ranges...
            </div>
          ) : assignedServices.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {assignedServices.map(({ service, assignments, matchedVehicle }) => {
                const categoryName = service.category?.name || "General";
                const categoryUi = CATEGORY_UI[categoryName] || {};
                const Icon = categoryUi.icon || FiTool;
                const serviceImage = getServiceThumbnailUrl(service);
                const comingSoon =
                  toBoolean(service.isComingSoon) ||
                  toBoolean(service.category?.isComingSoon);
                const hasPrice =
                  service.pricingStatus === "AVAILABLE" &&
                  Number.isFinite(Number(service.priceRange?.min)) &&
                  Number.isFinite(Number(service.priceRange?.max));
                const matchLabel = [
                  matchedVehicle?.brand || selectedBrand,
                  matchedVehicle?.model || selectedModel || "All models",
                  matchedVehicle?.fuelType || selectedFuelType || "Any fuel",
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <article
                    key={service.id}
                    className="overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-colors hover:border-ink/20"
                  >
                    <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="relative min-h-40 border-b border-line bg-bg-soft sm:border-b-0 sm:border-r">
                        {serviceImage ? (
                          <img
                            src={serviceImage}
                            alt={service.name}
                            className={`absolute inset-0 h-full w-full object-cover ${comingSoon ? "grayscale" : ""}`}
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center text-muted">
                            <Icon className="h-8 w-8" />
                          </div>
                        )}
                        {comingSoon && <ComingSoonOverlay />}
                      </div>

                      <div className="flex min-w-0 flex-col p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-muted">{categoryName}</span>
                            <h2 className="mt-1 text-base font-bold text-ink">{service.name}</h2>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
                            <FiCheckCircle className="h-3 w-3" />
                            Configured
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                          {service.description ||
                            "Service details are managed by the Rovauto admin team."}
                        </p>

                        <div className="mt-4 rounded-lg border border-line bg-bg-soft/60 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                            Matching vehicle
                          </p>
                          <p className="mt-2 text-sm font-bold text-ink">{matchLabel}</p>
                          <div className="mt-3 border-t border-line pt-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                              Admin allocation rules
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {assignments.map((assignment) => (
                                <span
                                  key={assignment.scopeKey}
                                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                                    assignment.isExcluded
                                      ? "border-red-200 bg-red-50 text-red-700"
                                      : "border-line bg-white text-ink"
                                  }`}
                                >
                                  {assignment.isExcluded ? "Excluded: " : ""}
                                  {getAssignmentLabel(assignment)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-line pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs text-muted">Customer price range</span>
                            <span
                              className={`text-right text-sm font-bold ${
                                hasPrice ? "text-ink" : "text-amber-700"
                              }`}
                            >
                              {comingSoon
                                ? "Coming soon"
                                : hasPrice
                                  ? formatRupeeRange(
                                      service.priceRange.min,
                                      service.priceRange.max,
                                    )
                                  : "Not allocated"}
                            </span>
                          </div>
                          {!comingSoon && !hasPrice && (
                            <p className="mt-2 text-xs leading-5 text-muted">
                              {service.priceUnavailableMessage ||
                                "No active price range matches this city and vehicle."}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-5 py-12 text-center shadow-sm">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-bg-soft text-muted">
                <FiTool className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink">
                No matching services for this vehicle
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Change the brand or model filter, or ask an administrator to
                update this garage&apos;s vehicle-specific service allocations.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
