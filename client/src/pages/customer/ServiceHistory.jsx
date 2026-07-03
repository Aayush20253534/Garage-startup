import { useEffect, useState } from "react";
import { FiDownload, FiStar } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getServicesText = (booking) => {
  return (
    booking.services
      ?.map((item) => item.service?.name)
      .filter(Boolean)
      .join(", ") || "Vehicle Service"
  );
};

const getAmount = (booking) => {
  return (
    booking.totalServiceAmount ||
    booking.payment?.amount ||
    booking.payableAmount ||
    booking.handlingFee ||
    0
  );
};

export default function ServiceHistory() {
  const { fetchServiceHistory } = useApp();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async ({ force = false } = {}) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      setError("");

      const data = await fetchServiceHistory({ force });
      setHistory(data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load service history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Service History</h2>
        <div className="card-soft p-6 text-muted">
          Loading service history...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold">Service History</h2>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadHistory({ force: true })}
          className="btn-ghost text-sm disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="card-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-soft text-left">
              <tr>
                {[
                  "Booking",
                  "Service",
                  "Garage",
                  "Date",
                  "Amount",
                  "Rating",
                  "",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {history.map((booking) => {
                const rating = booking.review?.rating || 0;

                return (
                  <tr key={booking.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">
                      #{booking.bookingCode}
                    </td>

                    <td className="px-4 py-3">{getServicesText(booking)}</td>

                    <td className="px-4 py-3">
                      {booking.garage?.name || "Auto-assigned garage"}
                    </td>

                    <td className="px-4 py-3">
                      {formatDate(booking.updatedAt || booking.createdAt)}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      Rs. {getAmount(booking)}
                    </td>

                    <td className="px-4 py-3 text-amber-500">
                      {rating > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: rating }).map((_, index) => (
                            <FiStar key={index} fill="currentColor" />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">Not rated</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-ghost !py-1.5 !px-3 text-xs"
                        onClick={() => window.print()}
                      >
                        <FiDownload /> Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}

              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No completed services yet.
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
