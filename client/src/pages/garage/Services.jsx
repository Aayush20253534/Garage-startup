import { useEffect, useState } from "react";
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
import {
  formatServicePriceRange,
  getServiceMaxPrice,
  getServiceMinPrice,
} from "@/utils/priceRange";
import { getServiceThumbnailUrl } from "@/utils/imageCache";

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

  const safeServices = Array.isArray(services) ? services : [];

  const loadServices = async () => {
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
  };

  useEffect(() => {
    loadServices();
  }, [garage?.id, dispatch]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Services
          </h1>
          <p className="mt-1 text-sm text-muted">
            Services currently linked to your garage.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadServices}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-bg-soft px-4 text-sm font-semibold text-muted"
          >
            <FiLock />
            Managed by Admin
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3">
        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading services...
          </div>
        ) : safeServices.length > 0 ? (
          safeServices.map((item) => {
            const service = item.service || item;
            const categoryName =
              service.category?.name || service.category || "General";

            const ui = CATEGORY_UI[categoryName] || {};
            const Icon = ui.icon || FiTool;
            const serviceImage = getServiceThumbnailUrl(service);
            const includes = getIncludes(service);
            const minPrice = getServiceMinPrice(service);
            const maxPrice = getServiceMaxPrice(service);

            return (
              <motion.article
                key={item.id || service.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-soft overflow-hidden rounded-2xl p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="h-36 w-full overflow-hidden rounded-2xl bg-bg-soft md:h-full md:min-h-[160px]">
                    {serviceImage ? (
                      <img
                        src={serviceImage}
                        alt={service.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-4xl text-muted">
                        <Icon />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-bold text-ink">
                          {service.name}
                        </h2>

                        <p className="mt-1 text-sm text-muted">
                          {categoryName}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-xl bg-brand-soft px-3 py-2 text-right">
                        <div className="text-lg font-bold text-ink">
                          {formatServicePriceRange(service)}
                        </div>

                        {maxPrice > minPrice && (
                          <div className="text-[11px] font-medium text-muted">
                            estimated range
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                        <FiStar fill="currentColor" />
                        4.8 verified
                      </span>

                      <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-muted">
                        Popular service
                      </span>

                      <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-muted">
                        {includes.length} included
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-line bg-white px-3 py-2">
                        <span className="font-semibold text-ink">
                          Warranty:
                        </span>{" "}
                        <span className="text-muted">
                          Service warranty available
                        </span>
                      </div>

                      <div className="rounded-xl border border-line bg-white px-3 py-2">
                        <span className="font-semibold text-ink">
                          Assignment:
                        </span>{" "}
                        <span className="text-muted">
                          Assigned to this garage
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-bg-soft p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                        Includes
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {includes.slice(0, 6).map((include) => (
                          <span
                            key={include}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink"
                          >
                            {include}
                          </span>
                        ))}

                        {includes.length > 6 && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted">
                            +{includes.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })
        ) : (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            {!garage?.id
              ? "Garage profile not loaded. Try refreshing the page."
              : "No services are linked to this garage yet. Services will be assigned by admin after approval."}
          </div>
        )}
      </section>
    </div>
  );
}