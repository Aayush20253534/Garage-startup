import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import { cityApi } from "@/api/cities";
import CitySelect from "@/components/common/CitySelect";
import CustomerActivityProfileModal from "@/components/admin/CustomerActivityProfileModal";
import { resetCityAvailabilityCache } from "@/utils/cityAvailability";
import {
  FiCheckCircle,
  FiClock,
  FiEye,
  FiLock,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUnlock,
  FiXCircle,
} from "react-icons/fi";

const normalizeCityToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\d{5,6}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const compact = (values = []) =>
  values.map((value) => String(value || "").trim()).filter(Boolean);

const getComponentText = (component = {}) =>
  component.longText ||
  component.long_name ||
  component.shortText ||
  component.short_name ||
  component.text ||
  "";

const hasComponentType = (component = {}, types = []) =>
  Array.isArray(component.types) &&
  types.some((type) => component.types.includes(type));

const splitAddressTokens = (address = "") =>
  compact(String(address || "").split(","))
    .map((part) => part.replace(/\b\d{5,6}\b/g, "").trim())
    .filter(Boolean)
    .filter((part) => !["india", "bharat"].includes(normalizeCityToken(part)));

const getPrimaryLocation = (customer) =>
  customer.locations?.find((location) => location.isDefault) ||
  customer.locations?.[0] ||
  null;

const getCustomerAddress = (customer) => {
  const location = getPrimaryLocation(customer);
  return (
    location?.formattedAddress ||
    location?.address ||
    customer.customerProfile?.address ||
    ""
  );
};

const getCustomerCity = (customer, cities = []) => {
  const location = getPrimaryLocation(customer);
  const address = getCustomerAddress(customer);
  const components = Array.isArray(location?.addressComponents)
    ? location.addressComponents
    : [];

  const componentCandidates = components
    .filter((component) =>
      hasComponentType(component, [
        "locality",
        "postal_town",
        "administrative_area_level_3",
        "administrative_area_level_2",
      ])
    )
    .map(getComponentText);

  const candidates = compact([
    ...componentCandidates,
    location?.city,
    location?.locality,
    location?.town,
    location?.district,
    ...splitAddressTokens(address),
  ]);

  const cityByKey = new Map(
    cities.map((city) => [normalizeCityToken(city.name), city])
  );

  for (const candidate of candidates) {
    const candidateKey = normalizeCityToken(candidate);
    const exactMatch = cityByKey.get(candidateKey);
    if (exactMatch) return exactMatch.name;

    const partialMatch = cities.find((city) => {
      const cityKey = normalizeCityToken(city.name);
      return (
        cityKey &&
        candidateKey &&
        (candidateKey.includes(cityKey) || cityKey.includes(candidateKey))
      );
    });

    if (partialMatch) return partialMatch.name;
  }

  const fallbackTokens = splitAddressTokens(address).filter(
    (part) => !/\b\d{5,6}\b/.test(part)
  );

  return fallbackTokens.length ? fallbackTokens.at(-2) || fallbackTokens.at(-1) : "-";
};

const formatLastSeen = (value) => {
  if (!value) return "No activity recorded";

  const timestamp = new Date(value);
  const elapsedMs = Date.now() - timestamp.getTime();

  if (!Number.isFinite(elapsedMs)) return "Unknown";
  if (elapsedMs < 60 * 1000) return "just now";
  if (elapsedMs < 60 * 60 * 1000) {
    return `${Math.floor(elapsedMs / (60 * 1000))}m ago`;
  }
  if (elapsedMs < 24 * 60 * 60 * 1000) {
    return `${Math.floor(elapsedMs / (60 * 60 * 1000))}h ago`;
  }

  return timestamp.toLocaleString();
};

const formatDeviceCount = (count) =>
  `${count || 0} ${count === 1 ? "device" : "devices"}`;

export default function Customers() {
  const navigate = useNavigate();
  const { user } = useApp();
  const isIntern = user?.role === "INTERN";
  const [customers, setCustomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityForm, setCityForm] = useState({ name: "", state: "" });
  const [filters, setFilters] = useState({ search: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [citySaving, setCitySaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [deletingCustomers, setDeletingCustomers] = useState(false);
  const [updatingCustomerId, setUpdatingCustomerId] = useState("");

  const customerRows = useMemo(
    () =>
      customers.map((customer) => ({
        ...customer,
        displayCity: getCustomerCity(customer, cities),
        displayAddress: getCustomerAddress(customer),
      })),
    [customers, cities]
  );

  const loggedInCount = useMemo(
    () => customerRows.filter((customer) => customer.isLoggedIn).length,
    [customerRows]
  );

  const onlineCount = useMemo(
    () => customerRows.filter((customer) => customer.isOnline).length,
    [customerRows]
  );

  const loadCities = async () => {
    try {
      const data = await cityApi.getAdminCities({ includeInactive: true });
      setCities(data || []);
    } catch {
      setCities([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value)
      );

      const data = await adminApi.getCustomers(params);
      setCustomers(data || []);
      setSelectedCustomerIds([]);
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

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId],
    );
  };

  const deleteSelectedCustomers = async () => {
    if (!selectedCustomerIds.length || deletingCustomers || isIntern) return;

    const count = selectedCustomerIds.length;
    if (!window.confirm(`Permanently delete ${count} selected customer${count === 1 ? "" : "s"} and all linked account data?`)) return;

    setDeletingCustomers(true);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.deleteCustomers(selectedCustomerIds);
      const deleted = result.deletedCustomers || count;
      setSuccess(`${deleted} customer${deleted === 1 ? "" : "s"} deleted.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete customers");
    } finally {
      setDeletingCustomers(false);
    }
  };


  const toggleCustomerAccess = async (customer) => {
    if (!customer?.id || updatingCustomerId || isIntern) return;

    const nextIsActive = !customer.isActive;
    const customerLabel = customer.name || customer.email || "this customer";
    const confirmationMessage = nextIsActive
      ? `Unblock ${customerLabel}? They will be able to sign in again.`
      : `Block ${customerLabel}? They will be logged out on every device and will not be able to sign in with email or Google.`;

    if (!window.confirm(confirmationMessage)) return;

    setUpdatingCustomerId(customer.id);
    setError("");
    setSuccess("");

    try {
      const updatedCustomer = await adminApi.setCustomerActiveStatus(
        customer.id,
        nextIsActive,
      );

      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id
            ? { ...item, ...updatedCustomer }
            : item,
        ),
      );
      setSuccess(
        nextIsActive
          ? `${customerLabel} has been unblocked.`
          : `${customerLabel} has been blocked and logged out from all devices.`,
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Unable to ${nextIsActive ? "unblock" : "block"} customer`,
      );
    } finally {
      setUpdatingCustomerId("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink">Customers</h2>
          <p className="mt-1 text-sm text-muted">
            Search, filter, and inspect customer accounts, sessions, and devices.
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

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FiMapPin className="text-muted" />
              <h3 className="text-sm font-bold text-ink">Service Cities</h3>
            </div>

            <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {cities.length ? (
                cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => toggleCity(city)}
                    title="Click to toggle city status"
                    className={[
                      "rounded-lg border px-3 py-1 text-xs font-semibold transition",
                      city.isActive
                        ? "border-lime-200 bg-lime-100 text-ink hover:bg-lime-200"
                        : "border-line bg-bg-soft text-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {city.name}
                    {city.state ? `, ${city.state}` : ""}
                    {!city.isActive ? " · inactive" : ""}
                  </button>
                ))
              ) : (
                <span className="text-sm text-muted">No cities added yet.</span>
              )}
            </div>
          </div>

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
        </div>
      </section>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="relative min-w-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder="Search name, email, phone"
              className="h-10 w-full rounded-lg border border-line pl-10 pr-3 text-sm outline-none transition focus:border-ink"
            />
          </label>

          <CitySelect
            value={filters.city}
            onChange={(city) => setFilters({ ...filters, city })}
            placeholder="City"
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink">Customer login activity</p>
            <p className="mt-0.5 text-xs text-muted">
              Online means the account used Rovauto within the last 5 minutes. Device totals include previous logins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {!isIntern && customerRows.length > 0 && (
              <>
                <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={selectedCustomerIds.length === customerRows.length}
                    onChange={(event) =>
                      setSelectedCustomerIds(
                        event.target.checked
                          ? customerRows.map((customer) => customer.id)
                          : [],
                      )
                    }
                  />
                  Select all
                </label>
                <button
                  type="button"
                  onClick={deleteSelectedCustomers}
                  disabled={!selectedCustomerIds.length || deletingCustomers}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiTrash2 />
                  {deletingCustomers ? "Deleting..." : `Delete selected${selectedCustomerIds.length ? ` (${selectedCustomerIds.length})` : ""}`}
                </button>
              </>
            )}
            <span className="rounded-full bg-lime-100 px-2.5 py-1 text-ink">
              {onlineCount} online
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
              {loggedInCount} logged in
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {!isIntern && (
                  <th className="w-12 px-4 py-3 font-bold">Select</th>
                )}
                {[
                  "Name",
                  "Email",
                  "Phone",
                  "City",
                  "Bookings",
                  "Vehicles",
                  "Login",
                  "Devices",
                  "Status",
                  "Access",
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
                  <td colSpan={isIntern ? 11 : 12} className="px-4 py-6 text-sm text-muted">
                    Loading customers...
                  </td>
                </tr>
              ) : customerRows.length ? (
                customerRows.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-t border-line transition hover:bg-bg-soft/70"
                  >
                    {!isIntern && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${customer.name || customer.email || "customer"}`}
                          checked={selectedCustomerIds.includes(customer.id)}
                          onChange={() => toggleCustomerSelection(customer.id)}
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                      {customer.name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {customer.email || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {customer.phone || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      <span title={customer.displayAddress || undefined}>
                        {customer.displayCity || "-"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {customer._count?.bookings || 0}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {customer._count?.vehicles || 0}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                            customer.isOnline
                              ? "bg-lime-100 text-ink"
                              : customer.isLoggedIn
                                ? "bg-blue-50 text-blue-700"
                                : "bg-bg-soft text-muted",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "h-2 w-2 rounded-full",
                              customer.isOnline
                                ? "bg-green-500"
                                : customer.isLoggedIn
                                  ? "bg-blue-500"
                                  : "bg-gray-400",
                            ].join(" ")}
                          />
                          {customer.isOnline
                            ? "Online now"
                            : customer.isLoggedIn
                              ? "Logged in"
                              : "Logged out"}
                        </span>

                        <span
                          className="text-[11px] text-muted"
                          title={
                            customer.lastSeenAt
                              ? new Date(customer.lastSeenAt).toLocaleString()
                              : undefined
                          }
                        >
                          {customer.lastSeenAt
                            ? `Last seen ${formatLastSeen(customer.lastSeenAt)}`
                            : "No recorded session"}
                          {customer.activeSessionCount >
                          customer.activeDeviceCount
                            ? ` · ${customer.activeSessionCount} sessions`
                            : ""}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink"
                          title="Unique devices or browsers recorded for this customer"
                        >
                          {formatDeviceCount(customer.knownDeviceCount)}
                        </span>
                        <span className="text-[11px] text-muted">
                          {customer.activeDeviceCount
                            ? `${customer.activeDeviceCount} active`
                            : "No active devices"}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          customer.isActive
                            ? "bg-lime-100 text-ink"
                            : "bg-bg-soft text-muted",
                        ].join(" ")}
                      >
                        {customer.isActive ? "Active" : "Blocked"}
                      </span>
                    </td>


                    <td className="whitespace-nowrap px-4 py-3">
                      {isIntern ? (
                        <span className="text-xs text-muted">Admin only</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleCustomerAccess(customer)}
                          disabled={updatingCustomerId === customer.id}
                          className={[
                            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                            customer.isActive
                              ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                              : "border-green-200 bg-white text-green-700 hover:bg-green-50",
                          ].join(" ")}
                        >
                          {customer.isActive ? <FiLock /> : <FiUnlock />}
                          {updatingCustomerId === customer.id
                            ? "Updating..."
                            : customer.isActive
                              ? "Block"
                              : "Unblock"}
                        </button>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerId(customer.id)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
                        >
                          <FiEye />
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `${isIntern ? "/intern" : "/admin"}/customers/${customer.id}/login-history`,
                            )
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
                        >
                          <FiClock />
                          View login history
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isIntern ? 11 : 12} className="px-4 py-6 text-sm text-muted">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCustomerId && (
        <CustomerActivityProfileModal
          userId={selectedCustomerId}
          onClose={() => setSelectedCustomerId("")}
        />
      )}
    </div>
  );
}
