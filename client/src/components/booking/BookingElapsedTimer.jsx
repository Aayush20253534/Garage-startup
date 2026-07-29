import { useEffect, useMemo, useState } from "react";
import { FiClock } from "react-icons/fi";
import { isSelfDropOffService } from "@/utils/serviceFulfillment";

const getEndTime = (booking) =>
  isSelfDropOffService(booking)
    ? booking?.arrivedAtGarageAt || null
    : booking?.finalPaymentConfirmedAt ||
      booking?.customerAcceptedAt ||
      (booking?.status === "COMPLETED" ? booking?.updatedAt : null);

const formatElapsed = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const clock = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return days > 0 ? `${days}d ${clock}` : clock;
};

export default function BookingElapsedTimer({
  booking,
  compact = false,
  className = "",
}) {
  const acceptedAt = booking?.acceptedAt;
  const selfDropOff = isSelfDropOffService(booking);
  const endAt = getEndTime(booking);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!acceptedAt || endAt) return undefined;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [acceptedAt, endAt]);

  const elapsed = useMemo(() => {
    if (!acceptedAt) return null;
    const start = new Date(acceptedAt).getTime();
    const end = endAt ? new Date(endAt).getTime() : now;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return formatElapsed(end - start);
  }, [acceptedAt, endAt, now]);

  if (!elapsed) return null;

  if (compact) {
    return (
      <div
        className={`flex min-w-0 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 ${className}`}
      >
        <FiClock className="h-4 w-4 shrink-0 text-brand-dark" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            {selfDropOff ? "Travel time to garage" : "Time since acceptance"}
          </p>
          <p className="font-mono text-sm font-bold tabular-nums text-ink">
            {elapsed}
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className={`rounded-xl border border-line bg-white p-4 shadow-sm ${className}`}
      aria-label="Booking elapsed time"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/20 text-brand-dark">
          <FiClock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
            {selfDropOff
              ? "Customer travel time to garage"
              : "Time since garage accepted"}
          </p>
          <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-ink sm:text-2xl">
            {elapsed}
          </p>
          <p className="mt-1 text-xs text-muted">
            {endAt
              ? selfDropOff
                ? "Stopped when the garage confirmed arrival"
                : "Final service duration"
              : selfDropOff
                ? "Running until you reach the garage"
                : "Counter updates every second"}
          </p>
        </div>
      </div>
    </section>
  );
}
