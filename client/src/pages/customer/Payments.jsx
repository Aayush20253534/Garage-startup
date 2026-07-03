import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import { isPaymentAuthError, payForBooking } from "@/utils/bookingPayment";

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

const canPay = (payment) => {
  return (
    payment.status === "CREATED" &&
    payment.booking?.status === "PENDING_PAYMENT"
  );
};

export default function Payments() {
  const { user, clearBookingCaches } = useApp();
  const nav = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/payments");
      setItems(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const payPayment = async (payment) => {
    try {
      setPayingId(payment.id);
      setError("");

      const verifiedBooking = await payForBooking({
        booking: payment.booking,
        user,
      });

      clearBookingCaches?.();
      await loadPayments();
      nav("/tracking", {
        state: {
          bookingId: verifiedBooking.id,
          bookingCode: verifiedBooking.bookingCode,
        },
      });
    } catch (err) {
      if (isPaymentAuthError(err)) {
        nav("/login", {
          state: {
            from: location,
            message: "Please login to continue payment.",
          },
        });
        return;
      }

      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not complete payment. Please try again.",
      );
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold">Payments</h2>
        <div className="card-soft p-6 text-muted">Loading payments...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Payments</h2>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left">
            <tr>
              {[
                "Txn ID",
                "Service",
                "Date",
                "Method",
                "Status",
                "Amount",
                "Action",
              ].map((heading) => (
                <th key={heading} className="px-4 py-3 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.map((payment) => (
              <tr key={payment.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">
                  {payment.cashfreePaymentId ||
                    payment.cashfreeOrderId ||
                    payment.id}
                </td>

                <td className="px-4 py-3">{getServiceText(payment)}</td>

                <td className="px-4 py-3">{formatDate(payment.createdAt)}</td>

                <td className="px-4 py-3">
                  {payment.walletAmountUsed > 0 && payment.upiAmountPaid > 0
                    ? "Wallet + UPI"
                    : payment.walletAmountUsed > 0
                      ? "Wallet"
                      : "Cashfree"}
                </td>

                <td className="px-4 py-3">
                  <span className="chip-brand">{payment.status}</span>
                </td>

                <td className="px-4 py-3 font-semibold">
                  Rs. {payment.amount}
                </td>

                <td className="px-4 py-3">
                  {canPay(payment) ? (
                    <button
                      type="button"
                      onClick={() => payPayment(payment)}
                      disabled={payingId === payment.id}
                      className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {payingId === payment.id ? "Processing..." : "Pay Now"}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
