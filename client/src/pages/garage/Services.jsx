import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiLayers,
  FiLock,
  FiRefreshCw,
  FiTag,
  FiTool,
} from "react-icons/fi";
import api from "@/api/axios";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import { CATEGORY_UI } from "@/data/services";
import { setServices } from "@/store/garageSlice";
import { getServiceThumbnailUrl } from "@/utils/imageCache";
import { formatServicePriceRange } from "@/utils/priceRange";

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

const getAssignmentLabel = ({ vehicleBrand, vehicleModel }) => {
  if (vehicleBrand === "NONE") {
    return "No vehicle brand · No vehicle model";
  }

  const brand = vehicleBrand && vehicleBrand !== "ALL"
    ? vehicleBrand
    : "All supported brands";

  if (vehicleModel === "NONE") return `${brand} · No vehicle model`;

  return vehicleModel && vehicleModel !== "ALL"
    ? `${brand} · ${vehicleModel}`
    : brand;
};

export default function GarageServices() {
  const { services, garage } = useSelector((state) => state.garage);
  const dispatch = useDispatch();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const safeAssignments = useMemo(
    () => (Array.isArray(services) ? services : []),
    [services],
  );
  const supportedBrands = useMemo(
    () => normalizeBrands(garage?.supportedBrands),
    [garage?.supportedBrands],
  );

  const assignedServices = useMemo(() => {
    const grouped = new Map();

    safeAssignments.forEach((assignment) => {
      const service = assignment?.service;
      if (!assignment?.id || !service?.id) return;

      if (!grouped.has(service.id)) {
        grouped.set(service.id, { service, assignments: [] });
      }

      const vehicleBrand = assignment.vehicleBrand || "ALL";
      const vehicleModel = assignment.vehicleModel || "ALL";
      const scopeKey = `${vehicleBrand.toLowerCase()}:${vehicleModel.toLowerCase()}`;
      const group = grouped.get(service.id);

      if (!group.assignments.some((item) => item.scopeKey === scopeKey)) {
        group.assignments.push({ vehicleBrand, vehicleModel, scopeKey });
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

  const loadServices = useCallback(async () => {
    if (!garage?.id) {
      dispatch(setServices([]));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get("/garages/me/services");
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
  }, [garage?.id, dispatch]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

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
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-soft px-2.5 py-1 text-xs font-semibold text-muted">
                  <FiLock className="h-3 w-3" />
                  Managed by admin
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                These are the services allocated to your garage. Booking alerts
                are matched against these allocations and your supported brands.
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

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiTool />
            </span>
            <p className="mt-4 text-2xl font-bold text-ink">{assignedServices.length}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Assigned services</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiLayers />
            </span>
            <p className="mt-4 text-2xl font-bold text-ink">{safeAssignments.length}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Vehicle scopes</p>
          </div>
          <div className="col-span-2 rounded-xl border border-line bg-white p-4 shadow-sm sm:col-span-1">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-soft text-ink">
              <FiTag />
            </span>
            <p className="mt-4 text-2xl font-bold text-ink">{supportedBrands.length}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Supported brands</p>
          </div>
        </section>

        {supportedBrands.length > 0 && (
          <section className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
              Your brand coverage
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {supportedBrands.map((brand) => (
                <span
                  key={brand}
                  className="rounded-lg border border-line bg-bg-soft px-2.5 py-1.5 text-xs font-semibold text-ink"
                >
                  {brand}
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-4 text-sm text-muted shadow-sm">
              <FiRefreshCw className="h-4 w-4 animate-spin" />
              Loading assigned services...
            </div>
          ) : assignedServices.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {assignedServices.map(({ service, assignments }) => {
                const categoryName = service.category?.name || "General";
                const categoryUi = CATEGORY_UI[categoryName] || {};
                const Icon = categoryUi.icon || FiTool;
                const serviceImage = getServiceThumbnailUrl(service);
                const comingSoon =
                  toBoolean(service.isComingSoon) ||
                  toBoolean(service.category?.isComingSoon);

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
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
                            <FiCheckCircle className="h-3 w-3" />
                            Assigned
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                          {service.description || "Service details are managed by the Rovauto admin team."}
                        </p>

                        <div className="mt-4 rounded-lg border border-line bg-bg-soft/60 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
                            Allocated vehicle coverage
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {assignments.map((assignment) => (
                              <span
                                key={assignment.scopeKey}
                                className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
                              >
                                {getAssignmentLabel(assignment)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                          <span className="text-xs text-muted">Customer estimate</span>
                          <span className="text-sm font-bold text-ink">
                            {comingSoon ? "Coming soon" : formatServicePriceRange(service)}
                          </span>
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
              <h3 className="mt-4 text-base font-bold text-ink">No services assigned yet</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Services will appear here after an administrator assigns them
                to this garage. Unassigned catalogue services are never shown.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
