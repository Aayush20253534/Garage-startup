import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBell,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiUserCheck,
} from "react-icons/fi";
import { garageApi } from "@/api/garage";

const bookingTitle = (booking) =>
  `${booking.vehicle?.brand || "Vehicle"} ${booking.vehicle?.model || ""}`.trim();

export default function ControllerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await garageApi.getControllerDashboard());
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load controller dashboard",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setAvailability = async (availability) => {
    try {
      setLoading(true);
      setError("");
      await garageApi.setControllerAvailability(availability);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to update availability",
      );
      setLoading(false);
    }
  };

  const controller = data?.controller;
  const stats = [
    [FiClock, "Active assignments", data?.active?.length || 0],
    [FiUserCheck, "Your completed history", data?.ownHistory?.length || 0],
    [FiBell, "Notifications", data?.notifications?.length || 0],
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Controller workspace
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">
              Welcome, {controller?.name || "controller"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Only your active assignments expose customer contact and location
              details. Keep your availability accurate to receive new work.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex">
            <button
              type="button"
              disabled={loading}
              onClick={() => void setAvailability("AVAILABLE")}
              className={`h-10 rounded-md border px-4 text-sm font-bold transition disabled:opacity-60 ${
                controller?.availability === "AVAILABLE"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-line bg-white text-ink hover:border-emerald-600"
              }`}
            >
              Available
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void setAvailability("BUSY")}
              className={`h-10 rounded-md border px-4 text-sm font-bold transition disabled:opacity-60 ${
                controller?.availability === "BUSY"
                  ? "border-amber-500 bg-amber-500 text-black"
                  : "border-line bg-white text-ink hover:border-amber-500"
              }`}
            >
              Busy
            </button>
            <button
              type="button"
              aria-label="Refresh dashboard"
              disabled={loading}
              onClick={() => void load()}
              className="grid h-10 w-10 place-items-center rounded-md border border-line bg-white text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(([Icon, label, value]) => (
          <article
            key={label}
            className="rounded-lg border border-line bg-white p-5 shadow-soft"
          >
            <div className="grid h-10 w-10 place-items-center rounded-md border border-line bg-bg-soft text-lg text-ink">
              <Icon />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-ink">{value}</p>
            <p className="mt-1 text-sm text-muted">{label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">Your active bookings</h2>
            <p className="mt-1 text-xs text-muted">
              Customer details are available only for assignments shown here.
            </p>
          </div>
          <Link
            to="/garage/bookings"
            className="rounded-md border border-line bg-white px-3 py-2 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
          >
            Open all bookings
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(data?.active || []).map((booking) => (
            <Link
              key={booking.id}
              to={`/garage/bookings/${booking.id}`}
              className="rounded-md border border-line bg-white p-4 transition hover:border-ink hover:bg-bg-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">
                    {bookingTitle(booking)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {booking.bookingCode} · {booking.user?.name || "Customer"}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-line bg-bg-soft px-2 py-1 text-[11px] font-bold text-ink">
                  {booking.status}
                </span>
              </div>
            </Link>
          ))}
          {!loading && !(data?.active || []).length && (
            <p className="rounded-md border border-dashed border-line bg-bg-soft px-4 py-8 text-center text-sm text-muted md:col-span-2">
              No active assignment. Stay available for new alerts.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div>
          <h2 className="font-bold text-ink">Combined garage history</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Completed and cancelled work from every controller. Other
            controllers’ customer phone and address remain hidden.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {(data?.combinedHistory || []).map((booking) => (
            <div
              key={booking.id}
              className="flex flex-col justify-between gap-3 rounded-md border border-line bg-white p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {bookingTitle(booking)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {booking.bookingCode} · handled by{" "}
                  {booking.garageController?.name || "central account"}
                </p>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-md border border-line bg-bg-soft px-2 py-1 text-xs font-bold text-ink">
                <FiCheckCircle />
                {booking.status}
              </span>
            </div>
          ))}
          {!loading && !(data?.combinedHistory || []).length && (
            <p className="rounded-md border border-dashed border-line bg-bg-soft px-4 py-8 text-center text-sm text-muted">
              No completed or cancelled booking history yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
