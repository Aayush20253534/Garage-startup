import { useEffect, useState } from "react";
import {
  FiCalendar,
  FiCreditCard,
  FiHash,
  FiRefreshCw,
} from "react-icons/fi";
import api from "@/api/axios";
import { formatRupees } from "@/utils/priceRange";

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getServiceText = (payment) => {
  return (
    payment.booking?.services
      ?.map((item) => item.service?.name)
      .filter(Boolean)
      .join(", ") || "Vehicle Service"
  );
};

const getTransactionId = (payment) =>
  payment.cashfreePaymentId || payment.cashfreeOrderId || payment.id;

const getMethodText = (payment) => {
  if (payment.walletAmountUsed > 0 && payment.upiAmountPaid > 0) {
    return "Wallet + UPI";
  }

  if (payment.walletAmountUsed > 0) return "Wallet";

  return "Cashfree";
};

const getStatusClasses = (status = "") => {
  const normalized = String(status).toUpperCase();

  if (["SUCCESS", "PAID", "COMPLETED"].includes(normalized)) {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (["FAILED", "CANCELLED", "CANCELED"].includes(normalized)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-brand/30 bg-brand/10 text-ink";
};

export default function Payments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadPayments = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      setError("");

      const res = await api.get("/payments");
      setItems(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Payments</h2>
        <div className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-sm">
          Loading payments...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="min-w-0 text-2xl font-bold sm:text-3xl">
          Payments
        </h2>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadPayments({ force: true })}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {items.map((payment) => (
          <article
            key={payment.id}
            className="overflow-hidden rounded-lg border border-line bg-white shadow-sm transition hover:border-ink/15 hover:shadow-md"
          >
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
                      <FiHash className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {getTransactionId(payment)}
                      </span>
                    </div>

                    <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-ink">
                      {getServiceText(payment)}
                    </h3>
                  </div>

                  <span
                    className={[
                      "inline-flex h-7 w-fit shrink-0 items-center rounded-md border px-2.5 text-[11px] font-bold",
                      getStatusClasses(payment.status),
                    ].join(" ")}
                  >
                    {payment.status || "UNKNOWN"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                    <FiCreditCard className="h-4 w-4 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        Method
                      </p>
                      <p className="truncate font-medium text-ink">
                        {getMethodText(payment)}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 rounded-md bg-bg-soft px-3 py-2">
                    <FiCalendar className="h-4 w-4 shrink-0 text-muted" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        Date
                      </p>
                      <p className="truncate font-medium text-ink">
                        {formatDate(payment.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="flex flex-col justify-center border-t border-line bg-bg-soft/50 p-4 sm:p-5 lg:border-l lg:border-t-0">
                <p className="text-xs font-medium text-muted">
                  Amount paid online
                </p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {formatRupees(payment.amount)}
                </p>

                {(Number(payment.walletAmountUsed) > 0 ||
                  Number(payment.upiAmountPaid) > 0) && (
                  <div className="mt-3 space-y-1 text-xs text-muted">
                    {Number(payment.walletAmountUsed) > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span>Wallet</span>
                        <span className="font-semibold text-ink">
                          {formatRupees(payment.walletAmountUsed)}
                        </span>
                      </div>
                    )}
                    {Number(payment.upiAmountPaid) > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span>UPI</span>
                        <span className="font-semibold text-ink">
                          {formatRupees(payment.upiAmountPaid)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </article>
        ))}

        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-muted shadow-sm">
            No online payments yet. Service costs are paid directly to the
            garage.
          </div>
        )}
      </div>
    </div>
  );
}
