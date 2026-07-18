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
  FiSend,
  FiShield,
  FiUser,
  FiTool,
} from "react-icons/fi";

const paymentTypes = [
  { value: "", label: "All payment records" },
  { value: "CUSTOMER_PLATFORM_FEE", label: "Customer platform fee" },
  { value: "GARAGE_PLATFORM_FEE", label: "Garage platform fee" },
  { value: "GARAGE_WALLET_RECHARGE", label: "Garage wallet recharge" },
  { value: "CUSTOMER_WALLET_RECHARGE", label: "Customer wallet recharge" },
  { value: "CUSTOMER_WALLET_PAYMENT", label: "Customer wallet payment" },
  { value: "CUSTOMER_SOS_CHARGE", label: "Customer SOS charge" },
  { value: "ADMIN_CUSTOMER_WALLET_CREDIT", label: "Admin → customer wallet" },
  { value: "ADMIN_GARAGE_WALLET_CREDIT", label: "Admin → garage wallet" },
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

const WalletTransferPanel = ({ onTransferred }) => {
  const [recipientType, setRecipientType] = useState("CUSTOMER");
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    setSelected(null);
    setReviewing(false);
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await adminApi.searchWalletTransferRecipients({
          type: recipientType,
          search: search.trim() || undefined,
        });
        setRecipients(Array.isArray(data) ? data : []);
      } catch (error) {
        setMessage({ type: "error", text: error.response?.data?.message || "Unable to search wallet recipients" });
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [recipientType, search]);

  const changeType = (type) => {
    setRecipientType(type);
    setSearch("");
    setRecipients([]);
    setMessage({ type: "", text: "" });
  };

  const recipientName = selected?.name || "Recipient";
  const recipientMeta = selected?.owner
    ? `${selected.owner.name} · ${selected.owner.phone || selected.owner.email || "Garage owner"}`
    : selected?.email || selected?.phone || "Customer";

  const reviewTransfer = (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!selected) return setMessage({ type: "error", text: "Select a recipient first" });
    if (!Number.isInteger(numericAmount) || numericAmount < 1 || numericAmount > 1000000) {
      return setMessage({ type: "error", text: "Enter a whole amount between Rs. 1 and Rs. 10,00,000" });
    }
    if (note.trim().length < 3) return setMessage({ type: "error", text: "Enter a transfer reason" });
    setMessage({ type: "", text: "" });
    setReviewing(true);
  };

  const confirmTransfer = async () => {
    setSubmitting(true);
    setMessage({ type: "", text: "" });
    try {
      const result = await adminApi.transferWalletFunds({
        recipientType,
        recipientId: selected.id,
        amount: Number(amount),
        note: note.trim(),
        requestId: crypto.randomUUID(),
      });
      setMessage({
        type: "success",
        text: `${formatCurrency(amount)} transferred to ${recipientName}. New balance: ${formatCurrency(result?.wallet?.balance ?? result?.transaction?.balanceAfter)}.`,
      });
      setAmount("");
      setNote("");
      setSelected(null);
      setReviewing(false);
      onTransferred?.();
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Wallet transfer failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="border-b border-line p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-ink"><FiSend /></div>
          <div><h3 className="font-bold text-ink">Transfer to wallet</h3><p className="mt-1 text-sm text-muted">Credit a customer or garage wallet. Every transfer is recorded in the ledger.</p></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="border-b border-line p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-bg-soft p-1">
            {[
              { value: "CUSTOMER", label: "Customers", icon: FiUser },
              { value: "GARAGE_OWNER", label: "Garage owners", icon: FiTool },
            ].map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => changeType(value)} className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition ${recipientType === value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                <Icon /> {label}
              </button>
            ))}
          </div>

          <label className="relative mt-4 block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={recipientType === "CUSTOMER" ? "Search customer by name, email or phone" : "Search garage or owner"} className={`${controlClass} pl-10`} />
          </label>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {recipients.map((recipient) => {
              const active = selected?.id === recipient.id;
              const meta = recipient.owner ? `${recipient.owner.name} · ${recipient.owner.phone || recipient.owner.email || "Owner"}` : recipient.email || recipient.phone;
              return (
                <button key={recipient.id} type="button" onClick={() => { setSelected(recipient); setReviewing(false); }} className={`w-full rounded-lg border p-3 text-left transition ${active ? "border-ink bg-bg-soft" : "border-line hover:border-ink/40"}`}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-ink">{recipient.name}</p><p className="mt-1 truncate text-xs text-muted">{meta || "No contact details"}</p></div><div className="shrink-0 text-right"><p className="text-[11px] uppercase tracking-wide text-muted">Balance</p><p className="text-sm font-bold text-ink">{formatCurrency(recipient.walletBalance)}</p></div></div>
                </button>
              );
            })}
            {!recipients.length && <p className="py-7 text-center text-sm text-muted">{searching ? "Searching..." : "No matching recipients found."}</p>}
          </div>
        </div>

        <form onSubmit={reviewTransfer} className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected recipient</p>
          <div className="mt-2 min-h-[66px] rounded-lg border border-line bg-bg-soft p-3">
            {selected ? <><p className="font-semibold text-ink">{recipientName}</p><p className="mt-1 text-xs text-muted">{recipientMeta}</p></> : <p className="py-2 text-sm text-muted">Choose a recipient from the list.</p>}
          </div>
          <label className="mt-4 block text-sm font-semibold text-ink">Amount (₹)<input type="number" min="1" max="1000000" step="1" value={amount} onChange={(event) => { setAmount(event.target.value); setReviewing(false); }} placeholder="Enter amount" className={`${controlClass} mt-2`} /></label>
          <label className="mt-4 block text-sm font-semibold text-ink">Transfer reason<textarea value={note} onChange={(event) => { setNote(event.target.value); setReviewing(false); }} maxLength={300} rows={3} placeholder="Why is this amount being credited?" className="mt-2 w-full resize-none rounded-lg border border-line bg-white p-3 text-sm outline-none transition focus:border-ink" /></label>

          {message.text && <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div>}
          {reviewing && selected && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Confirm wallet credit</p><p className="mt-1">Transfer {formatCurrency(amount)} to {recipientName}? This immediately changes their wallet balance.</p></div>}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {reviewing && <button type="button" onClick={() => setReviewing(false)} disabled={submitting} className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink">Edit</button>}
            <button type={reviewing ? "button" : "submit"} onClick={reviewing ? confirmTransfer : undefined} disabled={submitting || !selected} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"><FiSend />{submitting ? "Transferring..." : reviewing ? "Confirm transfer" : "Review transfer"}</button>
          </div>
        </form>
      </div>
    </section>
  );
};

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

        if (!isSuccessful) {
          return acc;
        }

        acc.successfulAmount += amount;

        if (record.type === "CUSTOMER_PLATFORM_FEE") {
          acc.customerPlatformFee += amount;
        } else if (record.type === "GARAGE_PLATFORM_FEE") {
          acc.garagePlatformFee += amount;
        } else if (
          record.type === "CUSTOMER_WALLET_RECHARGE" ||
          record.type === "GARAGE_WALLET_RECHARGE"
        ) {
          acc.walletRecharges += amount;
        }

        return acc;
      },
      {
        customerPlatformFee: 0,
        garagePlatformFee: 0,
        successfulAmount: 0,
        walletRecharges: 0,
      },
    );

    const customerPlatformFee = Number(
      summary?.customerPlatformFee ?? fallback.customerPlatformFee,
    );
    const garagePlatformFee = Number(
      summary?.garagePlatformFee ?? fallback.garagePlatformFee,
    );

    return {
      customerPlatformFee,
      garagePlatformFee,
      totalPlatformRevenue: Number(
        summary?.totalPlatformRevenue ?? customerPlatformFee + garagePlatformFee,
      ),
      walletRecharges: Number(summary?.walletRecharges ?? fallback.walletRecharges),
      successfulAmount: Number(summary?.successfulAmount ?? fallback.successfulAmount),
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
            Track platform revenue separately from wallet recharges and other cash-flow records.
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

      <WalletTransferPanel onTransferred={() => load()} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FiDollarSign}
          label="Total Revenue"
          value={formatCurrency(totals.totalPlatformRevenue)}
          caption="Customer platform fees + garage platform fees"
        />
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
          icon={FiSearch}
          label="Displayed Records"
          value={totals.totalRecords.toLocaleString("en-IN")}
          caption={`${formatCurrency(totals.successfulAmount)} successful cash flow shown`}
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
