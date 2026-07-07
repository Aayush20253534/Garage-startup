import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import CitySelect from "@/components/common/CitySelect";
import {
  FiCheckCircle,
  FiEdit3,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";

const fuelTypes = [
  "",
  "PETROL",
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
  "CNG",
  "OTHER",
];

const emptyForm = {
  id: "",
  city: "",
  serviceId: "",
  vehicleBrand: "",
  vehicleModel: "",
  fuelType: "",
  minPrice: "",
  maxPrice: "",
  isActive: true,
};

const getRangeScopeKey = (range = {}) =>
  [
    String(range.city || "").trim().toLowerCase(),
    range.serviceId || "",
    String(range.vehicleBrand || "").trim().toLowerCase(),
    String(range.vehicleModel || "").trim().toLowerCase(),
    range.fuelType || "",
  ].join("|");

const formatServiceLabel = (service = {}) =>
  [service.category?.name, service.name].filter(Boolean).join(" - ") ||
  service.id ||
  "Unknown service";

export default function Revenue() {
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [ranges, setRanges] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterCity, setFilterCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [rangeList, serviceList] = await Promise.all([
        adminApi.getPriceRanges(filterCity ? { city: filterCity.trim() } : {}),
        adminApi.getAssignableServices(),
      ]);

      setRanges(rangeList || []);
      setServices(serviceList || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load price ranges");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    adminApi
      .getCarBrands()
      .then((brands) => setVehicleBrands(Array.isArray(brands) ? brands : []))
      .catch(() => setVehicleBrands([]));
  }, []);

  useEffect(() => {
    load();
  }, []);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "vehicleBrand" && { vehicleModel: "" }),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const minPrice = Number(form.minPrice);
    const maxPrice = Number(form.maxPrice);

    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      setError("Enter valid min and max prices.");
      setSaving(false);
      return;
    }

    if (minPrice > maxPrice) {
      setError("Min price cannot be greater than max price.");
      setSaving(false);
      return;
    }

    const payload = {
      city: form.city.trim(),
      serviceId: form.serviceId,
      vehicleBrand: form.vehicleBrand.trim() || null,
      vehicleModel: form.vehicleModel.trim() || null,
      fuelType: form.fuelType || null,
      minPrice,
      maxPrice,
      isActive: form.isActive,
    };

    try {
      if (form.id) {
        await adminApi.updatePriceRange(form.id, payload);
        setSuccess("Price range updated.");
      } else {
        await adminApi.createPriceRange(payload);
        setSuccess("Price range created.");
      }

      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save price range");
    } finally {
      setSaving(false);
    }
  };

  const editRange = (range) => {
    setForm({
      id: range.id,
      city: range.city || "",
      serviceId: range.serviceId || "",
      vehicleBrand: range.vehicleBrand || "",
      vehicleModel: range.vehicleModel || "",
      fuelType: range.fuelType || "",
      minPrice: range.minPrice ?? "",
      maxPrice: range.maxPrice ?? "",
      isActive: Boolean(range.isActive),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteRange = async (range) => {
    const ok = window.confirm("Delete this price range?");
    if (!ok) return;

    setError("");
    setSuccess("");

    try {
      await adminApi.deletePriceRange(range.id);
      setSuccess("Price range deleted.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete price range");
    }
  };

  const selectedVehicleBrand = vehicleBrands.find(
    (brand) => brand.name === form.vehicleBrand
  );

  const vehicleModels = selectedVehicleBrand?.models || [];

  const duplicateScopeKeys = ranges.reduce((counts, range) => {
    const key = getRangeScopeKey(range);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Price Ranges</h2>
          <p className="mt-1 text-sm text-muted">
            Manage city and vehicle-specific service estimate ranges.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="hidden h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiXCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <FiCheckCircle className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form
        onSubmit={submit}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CitySelect
            required
            value={form.city}
            onChange={(city) => updateForm("city", city)}
            placeholder="City"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <select
            required
            value={form.serviceId}
            onChange={(e) => updateForm("serviceId", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            <option value="">Select service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.category?.name ? `${service.category.name} - ` : ""}
                {service.name}
              </option>
            ))}
          </select>

          <select
            value={form.vehicleBrand}
            onChange={(e) => updateForm("vehicleBrand", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            <option value="">Any brand</option>
            {vehicleBrands.map((brand) => (
              <option key={brand.id || brand.name} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </select>

          <select
            value={form.vehicleModel}
            onChange={(e) => updateForm("vehicleModel", e.target.value)}
            disabled={!form.vehicleBrand}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink disabled:bg-bg-soft"
          >
            <option value="">Any model</option>
            {vehicleModels.map((model) => (
              <option key={model.id || model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>

          <select
            value={form.fuelType}
            onChange={(e) => updateForm("fuelType", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            {fuelTypes.map((fuelType) => (
              <option key={fuelType || "any"} value={fuelType}>
                {fuelType || "Any fuel"}
              </option>
            ))}
          </select>

          <input
            required
            type="number"
            min="0"
            value={form.minPrice}
            onChange={(e) => updateForm("minPrice", e.target.value)}
            placeholder="Min price"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <input
            required
            type="number"
            min="0"
            value={form.maxPrice}
            onChange={(e) => updateForm("maxPrice", e.target.value)}
            placeholder="Max price"
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <div className="flex min-w-0 gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              {saving ? "Saving..." : form.id ? "Update" : "Create"}
            </button>

            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <CitySelect
            value={filterCity}
            onChange={setFilterCity}
            placeholder="Filter by city"
            includeInactive
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          />

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Search
          </button>
        </div>
      </section>

      <section className="card-soft overflow-hidden rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {[
                  "City",
                  "Service",
                  "Vehicle",
                  "Fuel",
                  "Range",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 font-bold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-sm text-muted">
                    Loading price ranges...
                  </td>
                </tr>
              ) : ranges.length ? (
                ranges.map((range) => {
                  const isDuplicate =
                    duplicateScopeKeys[getRangeScopeKey(range)] > 1;

                  return (
                    <tr
                      key={range.id}
                      className="border-t border-line transition hover:bg-bg-soft/70"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                        {range.city}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">
                          {formatServiceLabel(range.service)}
                        </div>

                        {isDuplicate && (
                          <div className="mt-1 text-xs font-semibold text-red-600">
                            Duplicate scope
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted">
                        {[range.vehicleBrand, range.vehicleModel]
                          .filter(Boolean)
                          .join(" / ") || "Any"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {range.fuelType || "Any"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        ₹{Number(range.minPrice).toLocaleString()} - ₹
                        {Number(range.maxPrice).toLocaleString()}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            range.isActive
                              ? "bg-lime-100 text-ink"
                              : "bg-bg-soft text-muted",
                          ].join(" ")}
                        >
                          {range.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editRange(range)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                            aria-label="Edit price range"
                          >
                            <FiEdit3 />
                          </button>

                          {!isIntern && (
                            <button
                              type="button"
                              onClick={() => deleteRange(range)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                              aria-label="Delete price range"
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-sm text-muted">
                    No price ranges found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}