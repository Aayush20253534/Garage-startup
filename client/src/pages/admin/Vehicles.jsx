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

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted">
            <FiShield /> Customer vehicle registry
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">Vehicles</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            View the registered Rovauto customer, vehicle number, and RC verification status across customer accounts.
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
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-b border-line bg-bg-soft text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Registered user</th>
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
                          <FiUser /> {vehicle.user?.name || "Unknown customer"}
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
