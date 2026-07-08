import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { formatRupees } from "@/utils/priceRange";
import {
  FiAlertCircle,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiRefreshCw,
  FiSearch,
  FiShield,
} from "react-icons/fi";

const paymentTypes = [
  { value: "", label: "All payment records" },
  { value: "CUSTOMER_PLATFORM_FEE", label: "Customer platform fee" },
  { value: "GARAGE_PLATFORM_FEE", label: "Garage platform fee" },
  { value: "GARAGE_WALLET_RECHARGE", label: "Garage wallet recharge" },
  { value: "CUSTOMER_WALLET_RECHARGE", label: "Customer wallet recharge" },
  { value: "CUSTOMER_WALLET_PAYMENT", label: "Customer wallet payment" },
  { value: "CUSTOMER_SOS_CHARGE", label: "Customer SOS charge" },
];

const statuses = [
  { value: "", label: "All statuses" },
  { value: "PAID", label: "Paid" },
  { value: "SUCCESS", label: "Success" },
  { value: "CREATED", label: "Created" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const typeLabels = paymentTypes.reduce((map, item) => {
  if (item.value) map[item.value] = item.label;
  return map;
}, {});

const initialFilters = {
  search: "",
  type: "",
  status: "",
  from: "",
  to: "",
};

const formatCurrency = (value) => formatRupees(value);

const formatDateTime = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStatus = (status) =>
  String(status || "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getStatusClass = (status) => {
  if (["PAID", "SUCCESS"].includes(status)) {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (["FAILED", "REFUNDED"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (["PENDING", "CREATED"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-line bg-bg-soft text-muted";
};

const getReference = (record) =>
  record.booking?.code ||
  record.cashfreeOrderId ||
  record.cashfreePaymentId ||
  record.sourceId ||
  "-";

const getPartyText = (record) => {
  if (record.garage) {
    return {
      name: record.garage.name || "Garage",
      meta: [record.garage.city, record.garage.email, record.garage.phone]
        .filter(Boolean)
        .join(" · "),
    };
  }

  if (record.customer) {
    return {
      name: record.customer.name || "Customer",
      meta: [record.customer.email, record.customer.phone]
        .filter(Boolean)
        .join(" · "),
    };
  }

  return { name: "Rovauto record", meta: "-" };
};

const getSecondaryReference = (record) => {
  if (record.booking?.services?.length) {
    return record.booking.services.join(", ");
  }

  if (record.description) {
    return record.description;
  }

  return record.cashfreePaymentId || "-";
};

const controlClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-ink";

const StatCard = ({ icon: Icon, label, value, caption }) => (
  <div className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
        {caption && <p className="mt-1 text-xs text-muted">{caption}</p>}
      </div>

      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg text-ink">
        <Icon />
      </div>
    </div>
  </div>
);

function Payments() {
  const [filters, setFilters] = useState(initialFilters);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (overrideFilters = filters) => {
    setLoading(true);
    setError("");

    try {
      const params = Object.fromEntries(
        Object.entries({ ...overrideFilters, limit: 500 }).filter(([, value]) =>
          value !== "" && value !== null && value !== undefined,
        ),
      );

      const data = await adminApi.getPayments(params);
      setRecords(Array.isArray(data?.records) ? data.records : []);
      setSummary(data?.summary || null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load payment records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const fallback = records.reduce(
      (acc, record) => {
        const amount = Number(record.amount || 0);
        const isSuccessful = ["PAID", "SUCCESS"].includes(record.status);

        if (isSuccessful) {
          acc.successfulAmount += amount;
        }

        return acc;
      },
      { successfulAmount: 0 },
    );

    return {
      customerPlatformFee: Number(summary?.customerPlatformFee || 0),
      garagePlatformFee: Number(summary?.garagePlatformFee || 0),
      walletRecharges: Number(summary?.walletRecharges || 0),
      successfulAmount: Number(summary?.successfulAmount || fallback.successfulAmount),
      totalRecords: Number(summary?.totalRecords ?? records.length),
    };
  }, [records, summary]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const submitFilters = (event) => {
    event.preventDefault();
    load(filters);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    load(initialFilters);
  };

  const exportCsv = () => {
    if (!records.length) return;

    const rows = [
      [
        "Date",
        "Type",
        "Status",
        "Amount",
        "Method",
        "Party",
        "Reference",
        "Cashfree Order ID",
        "Cashfree Payment ID",
      ],
      ...records.map((record) => {
        const party = getPartyText(record);
        return [
          formatDateTime(record.createdAt),
          typeLabels[record.type] || record.type,
          record.status || "",
          record.amount || 0,
          record.method || "",
          party.name,
          getReference(record),
          record.cashfreeOrderId || "",
          record.cashfreePaymentId || "",
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rovauto-payment-records-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Payments</h2>
          <p className="mt-1 text-sm text-muted">
            Track customer fees, garage fees, and wallet recharge records handled through the platform.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!records.length}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiDownload />
            Export
          </button>

          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FiCreditCard}
          label="Customer Platform Fee"
          value={formatCurrency(totals.customerPlatformFee)}
          caption="Paid booking platform fees"
        />
        <StatCard
          icon={FiShield}
          label="Garage Platform Fee"
          value={formatCurrency(totals.garagePlatformFee)}
          caption="Successful garage acceptance deductions"
        />
        <StatCard
          icon={FiDollarSign}
          label="Wallet Recharges"
          value={formatCurrency(totals.walletRecharges)}
          caption="Customer and garage recharge orders"
        />
        <StatCard
          icon={FiSearch}
          label="Displayed Records"
          value={totals.totalRecords.toLocaleString("en-IN")}
          caption={`${formatCurrency(totals.successfulAmount)} successful amount shown`}
        />
      </section>

      <form
        onSubmit={submitFilters}
        className="rounded-xl border border-line bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <label className="relative min-w-0 sm:col-span-2 xl:col-span-4">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search customer, garage, booking, order ID"
              className={`${controlClass} pl-10`}
            />
          </label>

          <select
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
            className={`${controlClass} min-w-0 xl:col-span-2`}
          >
            {paymentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className={`${controlClass} min-w-0 xl:col-span-2`}
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter("from", event.target.value)}
            className={`${controlClass} min-w-0 xl:col-span-2`}
          />

          <input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter("to", event.target.value)}
            className={`${controlClass} min-w-0 xl:col-span-2`}
          />

          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 xl:col-span-12">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 min-w-[118px] items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSearch />
              Search
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={loading}
              className="inline-flex h-11 min-w-[96px] items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
            <thead className="border-b border-line bg-bg-soft text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-[165px] px-4 py-3 font-semibold">Date</th>
                <th className="w-[190px] px-4 py-3 font-semibold">Payment Type</th>
                <th className="w-[230px] px-4 py-3 font-semibold">Party</th>
                <th className="w-[240px] px-4 py-3 font-semibold">Reference</th>
                <th className="w-[110px] px-4 py-3 font-semibold">Method</th>
                <th className="w-[115px] px-4 py-3 font-semibold">Status</th>
                <th className="w-[120px] px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => {
                const party = getPartyText(record);

                return (
                  <tr
                    key={record.id}
                    className="border-b border-line last:border-b-0 hover:bg-bg-soft/70"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-muted">
                      {formatDateTime(record.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="truncate font-semibold text-ink">
                        {typeLabels[record.type] || record.type || "Payment"}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {record.title || "Platform payment"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="truncate font-semibold text-ink">{party.name}</p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {party.meta || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="truncate font-mono text-xs font-semibold text-ink">
                        {getReference(record)}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {getSecondaryReference(record)}
                      </p>
                    </td>
                    <td className="truncate px-4 py-4 text-muted">
                      {record.method || "-"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}
                      >
                        {formatStatus(record.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-base font-bold text-ink">
                      {formatCurrency(record.amount)}
                    </td>
                  </tr>
                );
              })}

              {!records.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    {loading
                      ? "Loading payment records..."
                      : "No platform payment records found for the selected filters."}
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

export { Payments };
export default Payments;
