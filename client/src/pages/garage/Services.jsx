import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { FiLock, FiStar, FiTool } from "react-icons/fi";
import api from "@/api/axios";
import { setServices } from "@/store/garageSlice";
import { CATEGORY_UI } from "@/data/services";
import { formatServicePriceRange } from "@/utils/priceRange";
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

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-xl font-bold sm:text-2xl">
                        {service.name}
                      </h3>
                      <span className="chip-brand shrink-0">Assigned</span>
                    </div>

                    <div className="mb-2 flex flex-wrap items-baseline gap-3">
                      <span className="text-2xl font-bold text-ink">
                        {formatServicePriceRange(service)}
                      </span>
                      <span className="text-base text-muted">
                        estimated range
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        <FiStar className="text-amber-400" fill="currentColor" />
                        <span className="font-semibold">4.8</span>
                      </div>
                      <span className="text-sm text-muted">
                        Verified service
                      </span>
                      <span className="rounded-xl bg-bg-soft px-3 py-1.5 text-sm font-semibold text-muted">
                        {categoryName}
                      </span>
                    </div>

                    <p className="mb-4 text-sm leading-6 text-muted">
                      {service.description ||
                        "Service details available to customers during booking."}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-bg-soft px-4 py-3">
                        <span className="text-sm text-muted">Warranty</span>
                        <div className="font-semibold">Available</div>
                      </div>
                      <div className="rounded-xl bg-bg-soft px-4 py-3">
                        <span className="text-sm text-muted">
                          Services Included
                        </span>
                        <div className="font-semibold">{includes.length}</div>
                      </div>
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
