import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { formatRupees } from "@/utils/priceRange";
import {
  FiActivity,
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiMapPin,
  FiMonitor,
  FiRefreshCw,
  FiSmartphone,
  FiTruck,
  FiUser,
  FiX,
} from "react-icons/fi";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

const formatStatus = (value) => value?.replaceAll("_", " ") || "-";

const parseDevice = (userAgent = "") => {
  const value = String(userAgent || "");
  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /Chrome\//i.test(value)
      ? "Chrome"
      : /Firefox\//i.test(value)
        ? "Firefox"
        : /Safari\//i.test(value)
          ? "Safari"
          : "Browser";
  const platform = /Android/i.test(value)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(value)
      ? "iPhone/iPad"
      : /Windows/i.test(value)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown device";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(value);
  return { browser, platform, isMobile };
};

const getPrimaryLocation = (profile) =>
  profile?.locations?.find((location) => location.isDefault) ||
  profile?.locations?.[0] ||
  null;

export default function CustomerActivityProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setProfile(await adminApi.getCustomerProfile(userId));
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load customer profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const location = useMemo(() => getPrimaryLocation(profile), [profile]);
  const statusCounts = profile?.summary?.bookingStatusCounts || {};

  const tabs = [
    ["overview", "Overview"],
    ["bookings", `Bookings (${profile?.bookings?.length || 0})`],
    ["sessions", `Devices (${profile?.knownDeviceCount || 0})`],
    ["activity", "Activity"],
    ["support", "Support"],
  ];

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-black/65 px-3 py-4 sm:px-6 sm:py-8"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section role="dialog" aria-modal="true" className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-bg-soft shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Customer activity profile</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="truncate text-xl font-bold text-ink">{profile?.name || "Customer"}</h3>
                {profile && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${profile.isOnline ? "bg-lime-100 text-ink" : profile.isLoggedIn ? "bg-blue-50 text-blue-700" : "bg-bg-soft text-muted"}`}>
                    {profile.isOnline ? "Online now" : profile.isLoggedIn ? "Logged in" : "Logged out"}
                  </span>
                )}
              </div>
              {profile && <p className="mt-1 truncate text-sm text-muted">{profile.email} · {profile.phone || "No phone"}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={load} disabled={loading} className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink"><FiRefreshCw className={loading ? "animate-spin" : ""} /></button>
              <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink"><FiX /></button>
            </div>
          </div>

          {profile && (
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${tab === value ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </header>

        <div className="p-4 sm:p-6">
          {error && <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><FiAlertCircle />{error}</div>}
          {loading && !profile ? (
            <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">Loading customer profile...</div>
          ) : profile ? (
            <>
              {tab === "overview" && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      [FiCalendar, profile._count?.bookings || 0, "Total bookings"],
                      [FiTruck, profile._count?.vehicles || 0, "Vehicles"],
                      [FiCreditCard, formatRupees(profile.summary?.totalSpend || 0), "Total spend"],
                      [FiBriefcase, profile.summary?.supportTicketCount || 0, "Support tickets"],
                    ].map(([Icon, value, label]) => (
                      <article key={label} className="rounded-2xl border border-line bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-100 text-ink"><Icon /></span>
                          <span className="text-2xl font-bold text-ink">{value}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-muted">{label}</p>
                      </article>
                    ))}
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <article className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2 font-bold text-ink"><FiUser /> Account details</div>
                      <dl className="mt-4 grid gap-3 text-sm">
                        <div className="flex justify-between gap-4"><dt className="text-muted">Email verified</dt><dd className="font-bold text-ink">{profile.isEmailVerified ? "Yes" : "No"}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-muted">Phone verified</dt><dd className="font-bold text-ink">{profile.isPhoneVerified ? "Yes" : "No"}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-muted">Account status</dt><dd className="font-bold text-ink">{profile.isActive ? "Active" : "Disabled"}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-muted">Joined</dt><dd className="font-bold text-ink">{formatDateTime(profile.createdAt)}</dd></div>
                        <div className="flex justify-between gap-4"><dt className="text-muted">Last seen</dt><dd className="font-bold text-ink">{formatDateTime(profile.lastSeenAt)}</dd></div>
                      </dl>
                    </article>

                    <article className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex items-center gap-2 font-bold text-ink"><FiMapPin /> Location</div>
                      <p className="mt-4 text-sm leading-6 text-muted">{location?.formattedAddress || location?.address || profile.customerProfile?.address || "No address saved"}</p>
                      {location && <p className="mt-3 text-xs text-muted">Coordinates: {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}</p>}
                    </article>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <article className="rounded-2xl border border-line bg-white p-4">
                      <h4 className="font-bold text-ink">Vehicles</h4>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {(profile.vehicles || []).length ? profile.vehicles.map((vehicle) => (
                          <div key={vehicle.id} className="rounded-xl bg-bg-soft p-3">
                            <p className="font-bold text-ink">{vehicle.brand} {vehicle.model}</p>
                            <p className="mt-1 text-xs text-muted">{vehicle.year} · {vehicle.fuelType}</p>
                            <p className="mt-1 text-xs text-muted">{vehicle.registrationNumber || "No registration number"}</p>
                          </div>
                        )) : <p className="text-sm text-muted">No vehicles added.</p>}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-line bg-white p-4">
                      <h4 className="font-bold text-ink">Booking status summary</h4>
                      <div className="mt-4 grid gap-2">
                        {Object.keys(statusCounts).length ? Object.entries(statusCounts).sort((a, b) => Number(b[1]) - Number(a[1])).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between gap-3 rounded-lg bg-bg-soft px-3 py-2 text-sm"><span className="text-muted">{formatStatus(status)}</span><span className="font-bold text-ink">{count}</span></div>
                        )) : <p className="text-sm text-muted">No bookings yet.</p>}
                      </div>
                    </article>
                  </div>
                </div>
              )}

              {tab === "bookings" && (
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-bg-soft text-left text-xs uppercase tracking-wide text-muted">
                        <tr>{["Booking", "Vehicle", "Garage", "Status", "Service cost", "Created"].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
                      </thead>
                      <tbody>
                        {(profile.bookings || []).length ? profile.bookings.map((booking) => (
                          <tr key={booking.id} className="border-t border-line hover:bg-bg-soft/70">
                            <td className="px-4 py-3 font-bold text-ink">#{booking.bookingCode}</td>
                            <td className="px-4 py-3 text-muted">{booking.vehicle?.brand} {booking.vehicle?.model}</td>
                            <td className="px-4 py-3 text-muted">{booking.garage?.name || "Unassigned"}</td>
                            <td className="px-4 py-3"><span className="rounded-full bg-bg-soft px-2.5 py-1 text-xs font-bold text-muted">{formatStatus(booking.status)}</span></td>
                            <td className="px-4 py-3 font-semibold text-ink">{formatRupees(booking.totalServiceAmount || 0)}</td>
                            <td className="px-4 py-3 text-muted">{formatDateTime(booking.createdAt)}</td>
                          </tr>
                        )) : <tr><td colSpan="6" className="px-4 py-8 text-center text-muted">No bookings found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "sessions" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <article className="rounded-2xl border border-line bg-white p-4"><p className="text-sm text-muted">Known devices</p><p className="mt-2 text-3xl font-bold text-ink">{profile.knownDeviceCount || 0}</p></article>
                    <article className="rounded-2xl border border-line bg-white p-4"><p className="text-sm text-muted">Active devices</p><p className="mt-2 text-3xl font-bold text-ink">{profile.activeDeviceCount || 0}</p></article>
                    <article className="rounded-2xl border border-line bg-white p-4"><p className="text-sm text-muted">Active sessions</p><p className="mt-2 text-3xl font-bold text-ink">{profile.activeSessionCount || 0}</p></article>
                  </div>
                  <div className="grid gap-3">
                    {(profile.sessions || []).length ? profile.sessions.map((session) => {
                      const device = parseDevice(session.userAgent);
                      const Icon = device.isMobile ? FiSmartphone : FiMonitor;
                      return (
                        <article key={session.id} className="rounded-2xl border border-line bg-white p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg-soft text-ink"><Icon /></span>
                              <div className="min-w-0">
                                <p className="font-bold text-ink">{device.browser} on {device.platform}</p>
                                <p className="mt-1 truncate text-xs text-muted" title={session.userAgent || ""}>{session.userAgent || "User agent unavailable"}</p>
                                <p className="mt-2 text-xs text-muted">Last seen {formatDateTime(session.lastSeenAt)} · Created {formatDateTime(session.createdAt)}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${session.isActive ? "bg-lime-100 text-ink" : "bg-bg-soft text-muted"}`}>{session.isActive ? "Active" : session.revokedAt ? "Logged out" : "Expired"}</span>
                          </div>
                        </article>
                      );
                    }) : <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">No recorded sessions.</div>}
                  </div>
                </div>
              )}

              {tab === "activity" && (
                <div className="grid gap-3">
                  {(profile.customerActivities || []).length ? profile.customerActivities.map((activity) => (
                    <article key={activity.id} className="rounded-2xl border border-line bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg-soft text-ink"><FiActivity /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-bold text-ink">{activity.title}</p><time className="text-xs text-muted">{formatDateTime(activity.createdAt)}</time></div>
                          {activity.detail && <p className="mt-1 text-sm text-muted">{activity.detail}</p>}
                          {activity.path && <p className="mt-1 text-xs font-semibold text-blue-700">{activity.path}</p>}
                        </div>
                      </div>
                    </article>
                  )) : <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">No activity recorded.</div>}
                </div>
              )}

              {tab === "support" && (
                <div className="space-y-5">
                  <article className="rounded-2xl border border-line bg-white p-4">
                    <h4 className="font-bold text-ink">Support tickets and disputes</h4>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {(profile.supportTickets || []).length ? profile.supportTickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-xl bg-bg-soft p-3">
                          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-muted">{ticket.ticketCode} · {formatStatus(ticket.type)}</p><p className="mt-1 font-bold text-ink">{ticket.subject}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-muted">{formatStatus(ticket.status)}</span></div>
                          <p className="mt-2 line-clamp-2 text-sm text-muted">{ticket.description}</p>
                          <p className="mt-2 text-xs text-muted">{ticket.booking?.bookingCode ? `Booking #${ticket.booking.bookingCode} · ` : ""}{ticket.assignedTo?.name ? `Assigned to ${ticket.assignedTo.name} · ` : ""}{formatDateTime(ticket.lastMessageAt)}</p>
                        </div>
                      )) : <p className="text-sm text-muted">No support tickets.</p>}
                    </div>
                  </article>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <article className="rounded-2xl border border-line bg-white p-4">
                      <h4 className="font-bold text-ink">Legacy complaints</h4>
                      <div className="mt-4 grid gap-3">
                        {(profile.complaints || []).length ? profile.complaints.map((complaint) => (
                          <div key={complaint.id} className="rounded-xl bg-bg-soft p-3">
                            <div className="flex items-start justify-between gap-3"><p className="font-bold text-ink">{complaint.title}</p><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-muted">{formatStatus(complaint.status)}</span></div>
                            <p className="mt-2 text-sm text-muted">{complaint.description}</p>
                            <p className="mt-2 text-xs text-muted">{complaint.booking?.bookingCode ? `Booking #${complaint.booking.bookingCode} · ` : ""}{formatDateTime(complaint.createdAt)}</p>
                          </div>
                        )) : <p className="text-sm text-muted">No legacy complaints.</p>}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-line bg-white p-4">
                      <h4 className="font-bold text-ink">Wallet and recent transactions</h4>
                      <div className="mt-3 rounded-xl bg-lime-100 p-4"><p className="text-xs text-muted">Current wallet balance</p><p className="mt-1 text-2xl font-bold text-ink">{formatRupees(profile.wallet?.balance || 0)}</p></div>
                      <div className="mt-4 grid gap-2">
                        {(profile.walletTransactions || []).slice(0, 10).map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg-soft px-3 py-3 text-sm">
                            <div><p className="font-semibold text-ink">{formatStatus(transaction.type)}</p><p className="text-xs text-muted">{formatDateTime(transaction.createdAt)}</p></div>
                            <span className="font-bold text-ink">{formatRupees(transaction.amount || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
