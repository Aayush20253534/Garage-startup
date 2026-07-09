import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import {
  FiAlertCircle,
  FiLock,
  FiRefreshCw,
  FiStar,
  FiTool,
} from "react-icons/fi";
import api from "@/api/axios";
import { setServices } from "@/store/garageSlice";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import {
  formatServicePriceRange,
  getServiceMaxPrice,
  getServiceMinPrice,
} from "@/utils/priceRange";
import { getServiceThumbnailUrl } from "@/utils/imageCache";

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const getIncludes = (service) => {
  if (!service.description) return ["Service inspection", "Basic checks"];

  return service.description
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export default function GarageServices() {
  const { services, garage } = useSelector((state) => state.garage);
  const dispatch = useDispatch();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const safeServices = useMemo(
    () => (Array.isArray(services) ? services : []),
    [services]
  );

  const loadServices = useCallback(async () => {
    if (!garage?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.get("/garages/me/services");
      const servicesList = res.data?.data || [];
      dispatch(setServices(servicesList));
    } catch (err) {
      if (err.response?.status !== 404 && err.response?.status !== 403) {
        setError(
          err.response?.data?.message || "Unable to load garage services"
        );
      }

      dispatch(setServices([]));
    } finally {
      setLoading(false);
    }
  }, [garage?.id, dispatch]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand/5">
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header Section */}
        <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm ring-1 ring-black/[0.03] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                Services
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                View and manage services currently linked to your garage.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-3">
              <button
                type="button"
                disabled
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-muted shadow-sm cursor-not-allowed sm:w-auto"
              >
                <FiLock className="h-3.5 w-3.5" />
                Managed by Admin
              </button>

              <button
                type="button"
                onClick={loadServices}
                disabled={loading}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <FiRefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Services List Area */}
        <section className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white p-4 text-sm text-muted shadow-sm">
              <FiRefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading services...</span>
            </div>
          ) : safeServices.length > 0 ? (
            <div className="grid gap-4">
              {safeServices.map((item) => {
                const service = item.service || item;
                const categoryName =
                  service.category?.name || service.category || "General";

                const ui = CATEGORY_UI[categoryName] || {};
                const Icon = ui.icon || FiTool;
                const serviceImage = getServiceThumbnailUrl(service);
                const includes = getIncludes(service);
                const minPrice = getServiceMinPrice(service);
                const maxPrice = getServiceMaxPrice(service);

                const comingSoon =
                  toBoolean(service.isComingSoon) ||
                  toBoolean(service.category?.isComingSoon);

                return (
                  <motion.article
                    key={item.id || service.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm ring-1 ring-black/[0.02] transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Image Area */}
                      <div className="relative h-40 w-full shrink-0 border-b border-slate-100 bg-slate-50 sm:h-auto sm:w-52 sm:border-b-0 sm:border-r">
                        {serviceImage ? (
                          <img
                            src={serviceImage}
                            alt={service.name || "Garage service"}
                            className={`h-full w-full object-cover ${
                              comingSoon ? "blur-sm grayscale" : ""
                            }`}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted">
                            <Icon className="h-8 w-8" />
                          </div>
                        )}

                        {comingSoon && <ComingSoonOverlay />}
                      </div>

                      {/* Content Area */}
                      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                        {/* Top Row */}
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="max-w-full truncate text-base font-semibold text-ink sm:text-lg">
                                {service.name}
                              </h2>

                              {comingSoon && (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Coming Soon
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-muted">
                              {categoryName}
                            </p>
                          </div>

                          <div className="rounded-xl border border-brand/20 bg-brand/10 px-3 py-2 sm:min-w-[130px] sm:text-right">
                            <div className="text-base font-bold text-ink sm:text-lg">
                              {comingSoon
                                ? "TBD"
                                : formatServicePriceRange(service)}
                            </div>

                            {!comingSoon && maxPrice > minPrice && (
                              <div className="text-xs font-medium text-muted">
                                Estimated Range
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            <FiStar
                              className="h-3.5 w-3.5"
                              fill="currentColor"
                            />
                            4.8 verified
                          </span>

                          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-muted">
                            Assigned
                          </span>

                          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-muted">
                            Warranty available
                          </span>
                        </div>

                        {/* Warning */}
                        {comingSoon && (
                          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                            This service is visible to customers but cannot be
                            booked until an admin activates it.
                          </div>
                        )}

                        {/* Includes */}
                        <div className="mt-auto border-t border-slate-100 pt-4">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                            Includes
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {includes.slice(0, 6).map((include) => (
                              <span
                                key={include}
                                className="inline-flex max-w-full items-center rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-ink ring-1 ring-slate-100"
                              >
                                <span className="truncate">{include}</span>
                              </span>
                            ))}

                            {includes.length > 6 && (
                              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-muted">
                                +{includes.length - 6} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <FiTool className="mb-3 h-8 w-8 text-muted" />

              <h3 className="text-sm font-semibold text-ink">
                No services found
              </h3>

              <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
                {!garage?.id
                  ? "Garage profile not loaded. Try refreshing the page."
                  : "No services are linked to this garage yet. They will appear here once an admin assigns them to your profile."}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}