import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import CitySelect from "@/components/common/CitySelect";
import { FiEdit3, FiRefreshCw, FiTrash2 } from "react-icons/fi";

const fuelTypes = ["", "PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "OTHER"];

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

export default function Revenue() {
  const [ranges, setRanges] = useState([]);
  const [services, setServices] = useState([]);
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
    load();
  }, []);

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

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-5">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Price Ranges</h2>
        <p className="mt-1 text-sm text-muted sm:text-base">
          Manage city and vehicle-specific service estimate ranges.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <form
        onSubmit={submit}
        className="card-soft grid w-full max-w-full gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4"
      >
        <CitySelect
          required
          value={form.city}
          onChange={(city) => setForm({ ...form, city })}
          placeholder="City"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        />

        <select
          required
          value={form.serviceId}
          onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        >
          <option value="">Select service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.category?.name ? `${service.category.name} - ` : ""}
              {service.name}
            </option>
          ))}
        </select>

        <input
          value={form.vehicleBrand}
          onChange={(e) => setForm({ ...form, vehicleBrand: e.target.value })}
          placeholder="Vehicle brand optional"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        />

        <input
          value={form.vehicleModel}
          onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
          placeholder="Vehicle model optional"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        />

        <select
          value={form.fuelType}
          onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
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
          onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
          placeholder="Min price"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        />

        <input
          required
          type="number"
          min="0"
          value={form.maxPrice}
          onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
          placeholder="Max price"
          className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
        />

        <div className="flex min-w-0 gap-2 md:col-span-2 xl:col-span-1">
          <button disabled={saving} className="btn-primary min-w-0 flex-1">
            {saving ? "Saving..." : form.id ? "Update" : "Create"}
          </button>

          {form.id && (
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="btn-ghost shrink-0"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="flex w-full max-w-full flex-col gap-2 sm:flex-row">
        <CitySelect
          value={filterCity}
          onChange={setFilterCity}
          placeholder="Filter by city"
          includeInactive
          className="min-w-0 flex-1 rounded-xl border border-line px-4 py-2 outline-none focus:border-ink"
        />

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="btn-ghost justify-center !py-2"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="card-soft w-full max-w-full overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-bg-soft text-left">
              <tr>
                {["City", "Service", "Vehicle", "Fuel", "Range", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 font-semibold"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-5 text-muted">
                    Loading price ranges...
                  </td>
                </tr>
              ) : ranges.length ? (
                ranges.map((range) => (
                  <tr key={range.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {range.city}
                    </td>

                    <td className="px-4 py-3">
                      {range.service?.name || range.serviceId}
                    </td>

                    <td className="px-4 py-3">
                      {[range.vehicleBrand, range.vehicleModel]
                        .filter(Boolean)
                        .join(" / ") || "Any"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {range.fuelType || "Any"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      Rs. {Number(range.minPrice).toLocaleString()} - Rs.{" "}
                      {Number(range.maxPrice).toLocaleString()}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={range.isActive ? "chip-brand" : "chip"}>
                        {range.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editRange(range)}
                          className="btn-ghost !px-3 !py-2"
                          aria-label="Edit price range"
                        >
                          <FiEdit3 />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteRange(range)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-red-700"
                          aria-label="Delete price range"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-5 text-muted">
                    No price ranges found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
