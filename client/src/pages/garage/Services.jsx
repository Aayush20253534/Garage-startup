import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { FiLock, FiStar, FiTool } from "react-icons/fi";
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

  useEffect(() => {
    const load = async () => {
      // Fetch if garage exists and has an id
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
        // Only show error if it's not a 404 (no services yet) or 403 (not approved)
        if (err.response?.status !== 404 && err.response?.status !== 403) {
          setError(
            err.response?.data?.message || "Unable to load garage services",
          );
        }
        // Set empty services list instead of erroring
        dispatch(setServices([]));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [garage?.id, dispatch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted">Services currently linked to your garage</p>
        </div>
        <button disabled className="btn-ghost w-full sm:w-auto opacity-70">
          <FiLock className="w-4 h-4" />
          Managed by Admin
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="grid gap-4">
        {loading ? (
          <div className="card-soft p-5 text-muted">Loading services...</div>
        ) : services.length > 0 ? (
          services.map((item) => {
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
              <motion.div
                key={item.id || service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white p-4 shadow-lg sm:p-5"
              >
                <div className="flex flex-col gap-5 md:flex-row">
                  <div className="h-40 w-full flex-shrink-0 overflow-hidden rounded-2xl bg-bg-soft md:h-44 md:w-56">
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

                  <div className="flex-1">
                    <h2 className="mb-2 text-xl font-bold sm:text-2xl">
                      {service.name}
                    </h2>

                    <div className="mb-2 flex items-baseline gap-3">
                      <span className="text-2xl font-bold text-ink">
                        {formatServicePriceRange(service)}
                      </span>

                      {maxPrice > minPrice && (
                        <span className="text-base text-muted">
                          estimated range
                        </span>
                      )}
                    </div>

                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <FiStar className="text-amber-400" fill="currentColor" />
                        <span className="font-semibold">4.8</span>
                      </div>

                      <span className="text-sm text-muted">
                        Verified service
                      </span>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <div className="inline-block rounded-xl bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-800">
                        Popular service
                      </div>

                      <div className="inline-block rounded-xl bg-bg-soft px-3 py-1.5 text-sm font-medium text-muted">
                        {categoryName}
                      </div>
                    </div>

                    <ul className="mb-5 space-y-2">
                      <li className="flex items-start gap-2 text-base">
                        <span className="font-bold text-ink">Warranty:</span>
                        <span className="text-muted">
                          Service warranty available
                        </span>
                      </li>

                      <li className="flex items-start gap-2 text-base">
                        <span className="font-bold text-ink">Services:</span>
                        <span className="text-muted">
                          {includes.length} included
                        </span>
                      </li>
                    </ul>

                    <div className="my-4 border-t border-dashed border-gray-200"></div>

                    <div className="rounded-2xl border border-gray-200 px-4 py-3">
                      <span className="text-sm font-semibold text-muted">
                        Assigned to this garage
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="card-soft p-5 text-muted">
            {!garage?.id
              ? "Garage profile not loaded. Try refreshing the page."
              : "No services are linked to this garage yet. Services will be assigned by admin after approval."}
          </div>
        )}
      </div>
    </div>
  );
}
