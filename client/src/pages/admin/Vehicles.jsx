import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { queryKeys } from "@/lib/query/queryKeys";

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

const EMPTY_DATA = {
  items: [],
  total: 0,
  page: 1,
  limit: 40,
  totalPages: 1,
};

export default function AdminVehicles() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [page, setPage] = useState(1);
  const [lookupRegistration, setLookupRegistration] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 40,
      ...(submittedSearch && { search: submittedSearch }),
      ...(verificationStatus && { verificationStatus }),
    }),
    [page, submittedSearch, verificationStatus],
  );

  const vehiclesQuery = useQuery({
    queryKey: queryKeys.admin.vehicles(queryParams),
    queryFn: () => adminApi.getVehicles(queryParams),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const lookupMutation = useMutation({
    mutationFn: (registrationNumber) =>
      adminApi.lookupVehicleRegistration(registrationNumber),
    onSuccess: async (result, registrationNumber) => {
      setLookupRegistration(registrationNumber);
      setLookupResult(result);
      setLookupError("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "vehicles"] });
    },
    onError: (err) => {
      setLookupResult(null);
      setLookupError(
        err.response?.data?.message ||
          "Could not fetch this registration from Way2API",
      );
    },
  });

  const data = vehiclesQuery.data || EMPTY_DATA;
  const loading = vehiclesQuery.isLoading || vehiclesQuery.isFetching;
  const error =
    vehiclesQuery.error?.response?.data?.message ||
    vehiclesQuery.error?.message ||
    "";

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

  const submitRegistrationLookup = (event) => {
    event.preventDefault();
    const registrationNumber = lookupRegistration
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (registrationNumber.length < 5 || registrationNumber.length > 11) {
      setLookupResult(null);
      setLookupError("Enter a valid registration number");
      return;
    }

    setLookupError("");
    lookupMutation.mutate(registrationNumber);
  };

  return (
    <div className="admin-page space-y-4 pb-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted">
            <FiShield /> Customer vehicle registry
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Vehicles</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted">
            RC registered owner, Rovauto account, vehicle number and verification state in one operational view.
          </p>
        </div>
        <button
          type="button"
          onClick={() => vehiclesQuery.refetch()}
          disabled={loading}
          className="admin-btn-secondary shrink-0"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[
          [data.total || 0, "Total vehicles", "text-ink"],
          [summary.verified, "Verified on page", "text-green-700"],
          [summary.missing, "Missing on page", "text-ink"],
        ].map(([value, label, valueClass]) => (
          <article key={label} className="admin-panel px-3 py-3 sm:px-4">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-muted">{label}</p>
            <p className={`mt-1 text-xl font-black ${valueClass}`}>{value}</p>
          </article>
        ))}
      </section>

      <section className="admin-panel p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)] xl:items-end">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">Live RC lookup</p>
            <h2 className="mt-1 text-base font-black text-ink">Check registered vehicle owner</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
              Fetches the owner and RC details directly from Way2API. It does not use the customer account record.
            </p>
          </div>

          <form onSubmit={submitRegistrationLookup} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative min-w-0">
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
                className="h-10 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm font-bold uppercase tracking-wide outline-none transition focus:border-ink"
              />
            </label>
            <button
              type="submit"
              disabled={lookupMutation.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-xs font-black text-white transition hover:bg-ink/90 disabled:opacity-60"
            >
              {lookupMutation.isPending ? <FiRefreshCw className="animate-spin" /> : <FiSearch />}
              Check registration
            </button>
          </form>
        </div>

        {lookupError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
            {lookupError}
          </div>
        )}

        {lookupResult?.registrationNumber && (
          <div className="mt-3 rounded-xl border border-line bg-bg-soft/70 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">{lookupResult.registrationNumber}</p>
                <h3 className="mt-0.5 truncate text-lg font-black text-ink">{lookupResult.ownerName || "Owner name not available"}</h3>
              </div>
              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-black text-green-700">
                Live Way2API match
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Registered owner", lookupResult.ownerName || "Not available"],
                ["Registered phone", "Not supplied by Way2API"],
                ["Vehicle", [lookupResult.vehicle?.maker, lookupResult.vehicle?.model].filter(Boolean).join(" · ") || "Not available"],
                ["RC status", lookupResult.vehicle?.status || "Not available"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-lg border border-line bg-white px-3 py-2.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-muted">{label}</p>
                  <p className="mt-1 break-words text-xs font-black text-ink">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-x-5 gap-y-1 text-[11px] text-muted sm:grid-cols-2 xl:grid-cols-4">
              <p><span className="font-bold text-ink">Fuel:</span> {lookupResult.vehicle?.fuelType || "—"}</p>
              <p><span className="font-bold text-ink">Class:</span> {lookupResult.vehicle?.vehicleClass || "—"}</p>
              <p><span className="font-bold text-ink">Registered at:</span> {lookupResult.vehicle?.registeredAt || "—"}</p>
              <p><span className="font-bold text-ink">Registration date:</span> {lookupResult.vehicle?.registrationDate || "—"}</p>
            </div>

            <p className="mt-3 text-[10px] leading-4 text-amber-800">
              Way2API does not supply the registered mobile/phone field, so Rovauto does not substitute the account phone as RC data.
            </p>
          </div>
        )}
      </section>

      <form onSubmit={submitSearch} className="admin-panel grid gap-2.5 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_210px_auto]">
        <label className="relative min-w-0">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, email, phone, registration, brand or model"
            className="h-10 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none transition focus:border-ink"
          />
        </label>
        <select
          value={verificationStatus}
          onChange={(event) => {
            setVerificationStatus(event.target.value);
            setPage(1);
          }}
          className="h-10 min-w-0 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink outline-none focus:border-ink"
        >
          <option value="">All verification states</option>
          <option value="VERIFIED">RC verified</option>
          <option value="UNVERIFIED">Number present, unverified</option>
          <option value="MISSING">Registration missing</option>
        </select>
        <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-xs font-black text-white">
          <FiSearch /> Search
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="admin-panel overflow-hidden">
        {vehiclesQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-muted">Loading vehicles...</div>
        ) : data.items?.length ? (
          <>
            <div className="hidden max-w-full overflow-x-auto xl:block">
              <table className="w-full min-w-[1040px] table-fixed text-left text-xs">
                <thead className="border-b border-line bg-bg-soft text-[10px] uppercase tracking-[0.1em] text-muted">
                  <tr>
                    <th className="w-[18%] px-3.5 py-2.5">Registered name</th>
                    <th className="w-[18%] px-3.5 py-2.5">Account name</th>
                    <th className="w-[13%] px-3.5 py-2.5">Vehicle no.</th>
                    <th className="w-[16%] px-3.5 py-2.5">Vehicle</th>
                    <th className="w-[15%] px-3.5 py-2.5">Verification</th>
                    <th className="w-[12%] px-3.5 py-2.5">Account rule</th>
                    <th className="w-[8%] px-3.5 py-2.5">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((vehicle) => {
                    const meta = verificationMeta(vehicle);
                    return (
                      <tr key={vehicle.id} className="align-top hover:bg-bg-soft/50">
                        <td className="px-3.5 py-3">
                          <div className="truncate font-black text-ink" title={vehicle.rcOwnerName || ""}>
                            {vehicle.rcOwnerName || (vehicle.registrationVerified ? "Run live lookup" : "Not verified")}
                          </div>
                          <div className="mt-1 text-[10px] text-muted">{vehicle.registrationVerified ? "RC owner · Way2API" : "RC owner unavailable"}</div>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="truncate font-black text-ink">{vehicle.user?.name || "Unknown customer"}</div>
                          <div className="mt-1 truncate text-[10px] text-muted" title={vehicle.user?.email || vehicle.user?.phone || ""}>{vehicle.user?.email || vehicle.user?.phone || "—"}</div>
                        </td>
                        <td className="px-3.5 py-3 font-black tracking-wide text-ink">{vehicle.registrationNumber || "Not provided"}</td>
                        <td className="px-3.5 py-3">
                          <div className="truncate font-black text-ink">{vehicle.brand} {vehicle.model}</div>
                          <div className="mt-1 text-[10px] text-muted">{vehicle.fuelType} · {vehicle.year}</div>
                        </td>
                        <td className="px-3.5 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${meta.className}`}>{meta.label}</span>
                          {vehicle.registrationVerifiedAt && <div className="mt-1 text-[10px] text-muted">{formatDate(vehicle.registrationVerifiedAt)}</div>}
                          {providerLabel(vehicle.registrationVerificationProvider) && <div className="mt-1 text-[10px] font-semibold text-muted">{providerLabel(vehicle.registrationVerificationProvider)}</div>}
                        </td>
                        <td className="px-3.5 py-3 text-[10px] font-semibold leading-4 text-muted">
                          {vehicle.user?.vehicleRegistrationRequired ? "Registration required" : "Legacy · optional"}
                        </td>
                        <td className="px-3.5 py-3 text-[10px] leading-4 text-muted">{formatDate(vehicle.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2.5 p-3 xl:hidden sm:grid-cols-2">
              {data.items.map((vehicle) => {
                const meta = verificationMeta(vehicle);
                return (
                  <article key={vehicle.id} className="min-w-0 rounded-xl border border-line bg-bg-soft/60 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-xs font-black text-ink"><FiUser className="shrink-0" /> {vehicle.rcOwnerName || (vehicle.registrationVerified ? "Run live lookup" : "Not verified")}</p>
                        <p className="mt-1 truncate text-[11px] text-muted">Account: {vehicle.user?.name || "Unknown customer"}</p>
                        <p className="mt-2 break-all text-base font-black tracking-wide text-ink">{vehicle.registrationNumber || "Registration not provided"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${meta.className}`}>{meta.label}</span>
                    </div>
                    <div className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">
                      <p className="font-bold text-ink"><FiTruck className="mr-1 inline" /> {vehicle.brand} {vehicle.model}</p>
                      <p className="mt-1">{vehicle.fuelType} · {vehicle.year}</p>
                      <p className="mt-1 truncate">{vehicle.user?.email || vehicle.user?.phone || "No contact"}</p>
                      <p className="mt-1">{vehicle.user?.vehicleRegistrationRequired ? "Registration required" : "Legacy · optional"}</p>
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
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">Page {data.page || page} of {data.totalPages || 1}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || loading}
            className="admin-btn-secondary min-h-9 px-3 text-xs"
          >
            <FiChevronLeft /> Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(data.totalPages || 1, current + 1))}
            disabled={page >= (data.totalPages || 1) || loading}
            className="admin-btn-secondary min-h-9 px-3 text-xs"
          >
            Next <FiChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
