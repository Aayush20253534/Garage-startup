import { useEffect, useMemo, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { adminApi } from "@/api/admin";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};


const providerLabel = (value) => {
  if (value === "WAY2API_RC") return "Way2API";
  return String(value || "").trim();
};

const verificationMeta = (vehicle) => {
  if (vehicle.registrationVerified) {
    return {
      label: "RC verified",
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }
  if (vehicle.registrationNumber) {
    return {
      label: "Not verified",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "No registration",
    className: "border-line bg-bg-soft text-muted",
  };
};

export default function AdminVehicles() {
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    limit: 40,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lookupRegistration, setLookupRegistration] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  const load = async ({ targetPage = page } = {}) => {
    try {
      setLoading(true);
      setError("");
      const response = await adminApi.getVehicles({
        page: targetPage,
        limit: 40,
        search: submittedSearch || undefined,
        verificationStatus: verificationStatus || undefined,
      });
      setData(response || { items: [], total: 0, page: targetPage, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customer vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load({ targetPage: page });
  }, [page, submittedSearch, verificationStatus]);

  const summary = useMemo(() => {
    const visible = Array.isArray(data.items) ? data.items : [];
    return {
      verified: visible.filter((item) => item.registrationVerified).length,
      missing: visible.filter((item) => !item.registrationNumber).length,
    };
  }, [data.items]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  };

  const submitRegistrationLookup = async (event) => {
    event.preventDefault();
    const registrationNumber = lookupRegistration
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (registrationNumber.length < 5 || registrationNumber.length > 11) {
      setLookupResult(null);
      setLookupError("Enter a valid registration number");
      return;
    }

    try {
      setLookupLoading(true);
      setLookupError("");
      const result = await adminApi.lookupVehicleRegistration(registrationNumber);
      setLookupRegistration(registrationNumber);
      setLookupResult(result);
    } catch (err) {
      setLookupResult(null);
      setLookupError(
        err.response?.data?.message ||
          "Could not fetch this registration from Way2API",
      );
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted">
            <FiShield /> Customer vehicle registry
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">Vehicles</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            View the RC registered name from vehicle verification separately from the Rovauto account name, vehicle number, and verification status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => load({ targetPage: page })}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-ink disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-soft rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total vehicles</p>
          <p className="mt-2 text-2xl font-extrabold text-ink">{data.total || 0}</p>
        </div>
        <div className="card-soft rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Verified on this page</p>
          <p className="mt-2 text-2xl font-extrabold text-green-700">{summary.verified}</p>
        </div>
        <div className="card-soft rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Missing on this page</p>
          <p className="mt-2 text-2xl font-extrabold text-ink">{summary.missing}</p>
        </div>
      </div>

      <section className="card-soft rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Live RC lookup</p>
            <h2 className="mt-1 text-lg font-extrabold text-ink">Check registered vehicle owner</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Enter a registration number to fetch the RC owner and vehicle details directly from Way2API. This lookup does not use Rovauto customer records.
            </p>
          </div>

          <form onSubmit={submitRegistrationLookup} className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <FiTruck className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={lookupRegistration}
                onChange={(event) => {
                  setLookupRegistration(event.target.value.toUpperCase());
                  setLookupError("");
                  setLookupResult(null);
                }}
                maxLength={16}
                placeholder="e.g. UP70AB1234"
                className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm font-bold uppercase tracking-wide outline-none transition focus:border-ink"
              />
            </label>
            <button
              type="submit"
              disabled={lookupLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {lookupLoading ? <FiRefreshCw className="animate-spin" /> : <FiSearch />}
              Check registration
            </button>
          </form>
        </div>

        {lookupError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {lookupError}
          </div>
        )}

        {lookupResult?.registrationNumber && (
          <div className="mt-4 rounded-2xl border border-line bg-bg-soft p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {lookupResult.registrationNumber}
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-ink">
                  {lookupResult.ownerName || "Owner name not available"}
                </h3>
              </div>
              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                Live Way2API RC match
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Registered owner</p>
                <p className="mt-1 font-extrabold text-ink">{lookupResult.ownerName || "Not available"}</p>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Registered phone</p>
                <p className="mt-1 font-extrabold text-muted">Not supplied by Way2API</p>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Vehicle</p>
                <p className="mt-1 font-extrabold text-ink">
                  {[lookupResult.vehicle?.maker, lookupResult.vehicle?.model].filter(Boolean).join(" · ") || "Not available"}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">RC status</p>
                <p className="mt-1 font-extrabold text-ink">{lookupResult.vehicle?.status || "Not available"}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="font-bold text-ink">Fuel:</span> {lookupResult.vehicle?.fuelType || "—"}</p>
              <p><span className="font-bold text-ink">Class:</span> {lookupResult.vehicle?.vehicleClass || "—"}</p>
              <p><span className="font-bold text-ink">Registered at:</span> {lookupResult.vehicle?.registeredAt || "—"}</p>
              <p><span className="font-bold text-ink">Registration date:</span> {lookupResult.vehicle?.registrationDate || "—"}</p>
            </div>

            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              Way2API&apos;s Vehicle RC API currently documents the RC owner name but no registered mobile/phone field, so Rovauto cannot truthfully show the phone number from this provider.
            </p>
          </div>
        )}
      </section>

      <form onSubmit={submitSearch} className="card-soft grid gap-3 rounded-2xl p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="relative min-w-0">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, email, phone, registration, brand or model"
            className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none transition focus:border-ink"
          />
        </label>
        <select
          value={verificationStatus}
          onChange={(event) => {
            setVerificationStatus(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-ink"
        >
          <option value="">All verification states</option>
          <option value="VERIFIED">RC verified</option>
          <option value="UNVERIFIED">Number present, unverified</option>
          <option value="MISSING">Registration missing</option>
        </select>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90"
        >
          <FiSearch /> Search
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card-soft overflow-hidden rounded-2xl">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading vehicles...</div>
        ) : data.items?.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-line bg-bg-soft text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Registered name</th>
                    <th className="px-4 py-3">Account name</th>
                    <th className="px-4 py-3">Vehicle no.</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Verification</th>
                    <th className="px-4 py-3">Account rule</th>
                    <th className="px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((vehicle) => {
                    const meta = verificationMeta(vehicle);
                    return (
                      <tr key={vehicle.id} className="align-top hover:bg-bg-soft/60">
                        <td className="px-4 py-4">
                          <div className="font-bold text-ink">
                            {vehicle.rcOwnerNameMasked || (vehicle.registrationVerified ? "Not available" : "Not verified")}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {vehicle.registrationVerified ? "RC owner from Way2API" : "Verify RC to fetch owner"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-ink">{vehicle.user?.name || "Unknown customer"}</div>
                          <div className="mt-1 text-xs text-muted">{vehicle.user?.email || vehicle.user?.phone || "—"}</div>
                        </td>
                        <td className="px-4 py-4 font-extrabold tracking-wide text-ink">
                          {vehicle.registrationNumber || "Not provided"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-ink">{vehicle.brand} {vehicle.model}</div>
                          <div className="mt-1 text-xs text-muted">{vehicle.fuelType} · {vehicle.year}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                            {meta.label}
                          </span>
                          {vehicle.registrationVerifiedAt && (
                            <div className="mt-1 text-[11px] text-muted">{formatDate(vehicle.registrationVerifiedAt)}</div>
                          )}
                          {providerLabel(vehicle.registrationVerificationProvider) && (
                            <div className="mt-1 text-[11px] font-semibold text-muted">
                              Provider: {providerLabel(vehicle.registrationVerificationProvider)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-muted">
                          {vehicle.user?.vehicleRegistrationRequired ? "Registration required" : "Legacy customer · optional"}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted">{formatDate(vehicle.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line lg:hidden">
              {data.items.map((vehicle) => {
                const meta = verificationMeta(vehicle);
                return (
                  <article key={vehicle.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                          <FiUser /> Registered name: {vehicle.rcOwnerNameMasked || (vehicle.registrationVerified ? "Not available" : "Not verified")}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-muted">
                          Account name: {vehicle.user?.name || "Unknown customer"}
                        </div>
                        <div className="mt-2 break-all text-lg font-extrabold tracking-wide text-ink">
                          {vehicle.registrationNumber || "Registration not provided"}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 rounded-xl bg-bg-soft p-3 text-sm">
                      <div className="flex items-center gap-2 font-bold text-ink"><FiTruck /> {vehicle.brand} {vehicle.model}</div>
                      <div className="text-xs text-muted">{vehicle.fuelType} · {vehicle.year}</div>
                      <div className="text-xs text-muted">{vehicle.user?.email || vehicle.user?.phone || "No contact"}</div>
                      {providerLabel(vehicle.registrationVerificationProvider) && (
                        <div className="text-xs text-muted">
                          Verified via {providerLabel(vehicle.registrationVerificationProvider)}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-muted">
                        {vehicle.user?.vehicleRegistrationRequired ? "Registration required for this account" : "Legacy customer · registration optional"}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <FiTruck className="mx-auto text-3xl text-muted" />
            <p className="mt-3 font-bold text-ink">No vehicles found</p>
            <p className="mt-1 text-sm text-muted">Try changing the search or verification filter.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Page {data.page || page} of {data.totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink disabled:opacity-40"
          >
            <FiChevronLeft /> Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(data.totalPages || 1, current + 1))}
            disabled={page >= (data.totalPages || 1) || loading}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink disabled:opacity-40"
          >
            Next <FiChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
