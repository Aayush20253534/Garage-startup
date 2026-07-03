import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { FiLock } from "react-icons/fi";
import api from "@/api/axios";
import { setServices } from "@/store/garageSlice";

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="card-soft p-5 text-muted">Loading services...</div>
        ) : services.length > 0 ? (
          services.map((item) => {
            const service = item.service || item;
            const minPrice = service.minPrice ?? service.basePrice ?? item.price;
            const maxPrice = service.maxPrice ?? service.basePrice ?? item.price;
            return (
              <motion.div
                key={item.id || service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-soft p-4 sm:p-6"
              >
                <h3 className="text-lg sm:text-xl font-bold break-words mb-2">
                  {service.name}
                </h3>
                <p className="text-muted text-xs sm:text-sm mb-4 break-words">
                  {service.description ||
                    service.category?.name ||
                    "Garage service"}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted">Price range</span>
                    <span className="font-semibold">
                      ₹{" "}
                      {Number(minPrice || 0).toLocaleString()} - ₹{" "}
                      {Number(maxPrice || minPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted">Category</span>
                    <span className="font-semibold">
                      {service.category?.name || service.category || "General"}
                    </span>
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
