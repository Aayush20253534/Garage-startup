import { useEffect, useState } from "react";
import { adminApi } from "@/api/admin";
import { cityApi } from "@/api/cities";
import CitySelect from "@/components/common/CitySelect";
import { resetCityAvailabilityCache } from "@/utils/cityAvailability";
import { FiPlus, FiRefreshCw } from "react-icons/fi";

const getCity = (customer) => {
  const address =
    customer.locations?.[0]?.address || customer.customerProfile?.address || "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts[parts.length - 2] : address || "-";
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityForm, setCityForm] = useState({ name: "", state: "" });
  const [filters, setFilters] = useState({ search: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [citySaving, setCitySaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const data = await adminApi.getCustomers(params);
      setCustomers(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      setCities(await cityApi.getAdminCities({ includeInactive: true }));
    } catch {
      setCities([]);
    }
  };

  const addCity = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCitySaving(true);
    try {
      await cityApi.createCity(cityForm);
      resetCityAvailabilityCache();
      setCityForm({ name: "", state: "" });
      setSuccess("City added.");
      await loadCities();
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
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update city");
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-5">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Customers</h2>
        <p className="mt-1 text-sm text-muted sm:text-base">
          Search and inspect registered customer accounts.
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

      <div className="card-soft grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <div>
          <h3 className="font-bold">Cities</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {cities.length ? cities.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => toggleCity(city)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${city.isActive ? "bg-brand-soft text-ink" : "bg-bg-soft text-muted"}`}
              >
                {city.name}{city.state ? `, ${city.state}` : ""}{city.isActive ? "" : " (Inactive)"}
              </button>
            )) : (
              <span className="text-sm text-muted">No cities added yet.</span>
            )}
          </div>
        </div>

        <form onSubmit={addCity} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:grid-cols-1">
          <input
            required
            value={cityForm.name}
            onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
            placeholder="City name"
            className="min-w-0 rounded-xl border border-line px-4 py-2 outline-none focus:border-ink"
          />
          <input
            value={cityForm.state}
            onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })}
            placeholder="State optional"
            className="min-w-0 rounded-xl border border-line px-4 py-2 outline-none focus:border-ink"
          />
          <button disabled={citySaving} className="btn-primary justify-center !py-2">
            <FiPlus /> {citySaving ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      <div className="flex w-full max-w-full flex-col gap-2 sm:flex-row">
        <input
          value={filters.search}
          onChange={(e) =>
            setFilters({ ...filters, search: e.target.value })
          }
          placeholder="Search name, email, phone"
          className="min-w-0 flex-1 rounded-xl border border-line px-4 py-2 outline-none focus:border-ink"
        />

        <CitySelect
          value={filters.city}
          onChange={(city) => setFilters({ ...filters, city })}
          placeholder="City"
          includeInactive
          className="min-w-0 rounded-xl border border-line px-4 py-2 outline-none focus:border-ink sm:w-48"
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
          <table className="min-w-[850px] w-full text-sm">
            <thead className="bg-bg-soft text-left">
              <tr>
                {[
                  "Name",
                  "Email",
                  "Phone",
                  "City",
                  "Bookings",
                  "Vehicles",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-5 text-muted">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length ? (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {customer.name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {customer.email || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {customer.phone || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {getCity(customer)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {customer._count?.bookings || 0}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {customer._count?.vehicles || 0}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={customer.isActive ? "chip-brand" : "chip"}>
                        {customer.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-5 text-muted">
                    No customers found.
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
