import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import { formatRupeeRange } from "@/utils/priceRange";
import { cityApi } from "@/api/cities";
import { useApp } from "@/hooks/useApp";
import CitySelect from "@/components/common/CitySelect";
import { resetCityAvailabilityCache } from "@/utils/cityAvailability";
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
  const [cities, setCities] = useState([]);
  const [vehicleBrands, setVehicleBrands] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [cityForm, setCityForm] = useState({ name: "", state: "" });
  const [filterCity, setFilterCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [citySaving, setCitySaving] = useState(false);
  const [citySelectKey, setCitySelectKey] = useState(0);
  const [selectedRangeIds, setSelectedRangeIds] = useState([]);
  const [deletingRanges, setDeletingRanges] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCities = async () => {
    try {
      const data = await cityApi.getAdminCities({ includeInactive: true });
      setCities(Array.isArray(data) ? data : []);
    } catch {
      setCities([]);
    }
  };

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
      setSelectedRangeIds([]);
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
    loadCities();
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

    if (!form.vehicleBrand.trim()) {
      setError("Select a vehicle brand. Brand is required for service visibility.");
      setSaving(false);
      return;
    }

    const payload = {
      city: form.city.trim(),
      serviceId: form.serviceId,
      vehicleBrand: form.vehicleBrand.trim(),
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

  const addCity = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCitySaving(true);

    try {
      const city = await cityApi.createCity(cityForm);
      resetCityAvailabilityCache();
      setCityForm({ name: "", state: "" });
      setForm((current) => ({
        ...current,
        city: city?.name || current.city,
      }));
      setFilterCity(city?.name || filterCity);
      setSuccess("City added. You can now create price ranges for it.");
      await loadCities();
      setCitySelectKey((key) => key + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add city");
    } finally {
      setCitySaving(false);
    }
  };

  const toggleCity = async (city) => {
    setError("");
    setSuccess("");

    try {
      await cityApi.updateCity(city.id, { isActive: !city.isActive });
      resetCityAvailabilityCache();
      await loadCities();
      setCitySelectKey((key) => key + 1);
      setSuccess(`${city.name} ${city.isActive ? "disabled" : "enabled"}.`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update city");
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

  const visibleRangeIds = ranges.map((range) => range.id);
  const allVisibleRangesSelected =
    visibleRangeIds.length > 0 &&
    visibleRangeIds.every((rangeId) => selectedRangeIds.includes(rangeId));

  const toggleRangeSelection = (rangeId) => {
    setSelectedRangeIds((current) =>
      current.includes(rangeId)
        ? current.filter((id) => id !== rangeId)
        : [...current, rangeId],
    );
  };

  const toggleAllVisibleRanges = () => {
    setSelectedRangeIds(allVisibleRangesSelected ? [] : visibleRangeIds);
  };

  const deleteSelectedRanges = async () => {
    const rangeIds = selectedRangeIds.filter((rangeId) =>
      visibleRangeIds.includes(rangeId),
    );
    if (!rangeIds.length) return;

    const confirmed = window.confirm(
      `Delete ${rangeIds.length} selected price range${rangeIds.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingRanges(true);
    setError("");
    setSuccess("");

    try {
      const result = await adminApi.deletePriceRanges(rangeIds, false);
      if (rangeIds.includes(form.id)) setForm(emptyForm);
      setSuccess(
        `${result.deleted || rangeIds.length} price range${(result.deleted || rangeIds.length) === 1 ? "" : "s"} deleted.`,
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete selected price ranges");
    } finally {
      setDeletingRanges(false);
    }
  };

  const deleteAllRanges = async () => {
    const confirmation = window.prompt(
      "This deletes every price range across all cities. Type DELETE ALL PRICE RANGES to continue.",
    );
    if (confirmation !== "DELETE ALL PRICE RANGES") return;

    setDeletingRanges(true);
    setError("");
    setSuccess("");

    try {
      const result = await adminApi.deletePriceRanges([], true);
      setForm(emptyForm);
      setSuccess(
        `${result.deleted || 0} price range${result.deleted === 1 ? "" : "s"} deleted across all cities.`,
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete all price ranges");
    } finally {
      setDeletingRanges(false);
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
          <h2 className="text-2xl font-bold text-ink">
            Price Ranges
          </h2>
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

      {isIntern ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          Intern access is read-only. An admin must change cities or service price ranges.
        </div>
      ) : (
      <form
        onSubmit={submit}
        className="card-soft rounded-2xl p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CitySelect
            key={`form-city-${citySelectKey}`}
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
            required
            value={form.vehicleBrand}
            onChange={(e) => updateForm("vehicleBrand", e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
          >
            <option value="">Select brand</option>
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
            <option value="">All models</option>
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
      )}

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink">Service Cities</h3>
            <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {cities.length ? (
                cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => !isIntern && toggleCity(city)}
                    disabled={isIntern}
                    title={isIntern ? "Intern access is read-only" : "Click to toggle city status"}
                    className={[
                      "rounded-lg border px-3 py-1 text-xs font-semibold transition",
                      city.isActive
                        ? "border-lime-200 bg-lime-100 text-ink hover:bg-lime-200"
                        : "border-line bg-bg-soft text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {city.name}
                    {city.state ? `, ${city.state}` : ""}
                    {!city.isActive ? " - inactive" : ""}
                  </button>
                ))
              ) : (
                <span className="text-sm text-muted">No cities added yet.</span>
              )}
            </div>
          </div>

          {!isIntern && (
          <form
            onSubmit={addCity}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px]"
          >
            <input
              required
              value={cityForm.name}
              onChange={(e) =>
                setCityForm({ ...cityForm, name: e.target.value })
              }
              placeholder="City name"
              className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
            />

            <input
              value={cityForm.state}
              onChange={(e) =>
                setCityForm({ ...cityForm, state: e.target.value })
              }
              placeholder="State"
              className="h-10 min-w-0 rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
            />

            <button
              type="submit"
              disabled={citySaving}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-lime-400 px-3 text-sm font-bold text-black transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              {citySaving ? "..." : "Add"}
            </button>
          </form>
          )}
        </div>
      </section>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <CitySelect
            key={`filter-city-${citySelectKey}`}
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
        <div className="flex flex-col gap-3 border-b border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Price range records</p>
            <p className="mt-1 text-xs text-muted">
              {ranges.length} shown · {selectedRangeIds.length} selected
            </p>
          </div>

          {!isIntern && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAllVisibleRanges}
                disabled={!ranges.length || loading || deletingRanges}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allVisibleRangesSelected ? "Clear selection" : "Select all shown"}
              </button>
              <button
                type="button"
                onClick={deleteSelectedRanges}
                disabled={!selectedRangeIds.length || loading || deletingRanges}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 />
                Delete selected ({selectedRangeIds.length})
              </button>
              <button
                type="button"
                onClick={deleteAllRanges}
                disabled={loading || deletingRanges}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiTrash2 />
                {deletingRanges ? "Deleting..." : "Delete all cities"}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-12 px-4 py-3">
                  {!isIntern && (
                    <input
                      type="checkbox"
                      checked={allVisibleRangesSelected}
                      disabled={!ranges.length || loading || deletingRanges}
                      onChange={toggleAllVisibleRanges}
                      className="h-4 w-4 rounded border-line accent-ink"
                      aria-label="Select all shown price ranges"
                    />
                  )}
                </th>
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
                  <td colSpan="8" className="px-4 py-6 text-sm text-muted">
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
                      className={`border-t border-line transition hover:bg-bg-soft/70 ${
                        selectedRangeIds.includes(range.id) ? "bg-bg-soft/80" : ""
                      }`}
                    >
                      <td className="w-12 px-4 py-3">
                        {!isIntern && (
                          <input
                            type="checkbox"
                            checked={selectedRangeIds.includes(range.id)}
                            disabled={deletingRanges}
                            onChange={() => toggleRangeSelection(range.id)}
                            className="h-4 w-4 rounded border-line accent-ink"
                            aria-label={`Select price range for ${range.city}`}
                          />
                        )}
                      </td>
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
                        {range.vehicleBrand
                          ? `${range.vehicleBrand} / ${range.vehicleModel || "All models"}`
                          : "Missing brand"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {range.fuelType || "Any"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-semibold">
                        {formatRupeeRange(range.minPrice, range.maxPrice)}
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
                          {!isIntern ? (
                          <>
                          <button
                            type="button"
                            onClick={() => editRange(range)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
                            aria-label="Edit price range"
                          >
                            <FiEdit3 />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteRange(range)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100"
                            aria-label="Delete price range"
                          >
                            <FiTrash2 />
                          </button>
                          </>
                          ) : (
                            <span className="text-xs font-semibold text-muted">Read only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-sm text-muted">
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
