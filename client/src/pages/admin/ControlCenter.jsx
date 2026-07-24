import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { useApp } from "@/hooks/useApp";
import { cityApi } from "@/api/cities";
import BookingManagementModal from "@/components/admin/BookingManagementModal";
import { formatRupees } from "@/utils/priceRange";
import {
  FiActivity,
  FiAlertCircle,
  FiBarChart2,
  FiBell,
  FiCheck,
  FiClock,
  FiDownload,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShield,
  FiSlash,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiX,
} from "react-icons/fi";

const tabs = [
  ["escalations", "Escalations", FiAlertCircle],
  ["support", "Booking Support", FiUsers],
  ["garages", "Garage Performance", FiBarChart2],
  ["pricing", "Pricing Control", FiActivity],
  ["availability", "Availability", FiClock],
  ["audit", "Audit Logs", FiFileText],
];

const operationalStatuses = [
  "ACTIVE",
  "TEMPORARILY_SUSPENDED",
  "UNDER_REVIEW",
  "DOCUMENTS_EXPIRED",
  "PERMANENTLY_BLOCKED",
];
const fuelTypes = ["", "PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "OTHER"];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const fieldClass = "h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};
const formatStatus = (value) => String(value || "-").replaceAll("_", " ");
const statusTone = (status) => {
  const value = String(status || "");
  if (["ACTIVE", "COMPLETED", "RESOLVED", "APPLIED"].includes(value)) return "border-green-200 bg-green-50 text-green-700";
  if (["HIGH", "CRITICAL", "PERMANENTLY_BLOCKED", "DOCUMENTS_EXPIRED", "CANCELLED"].includes(value)) return "border-red-200 bg-red-50 text-red-700";
  if (["ACKNOWLEDGED", "TEMPORARILY_SUSPENDED", "PENDING"].includes(value)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
};

function Badge({ value }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(value)}`}>{formatStatus(value)}</span>;
}

function StatCard({ label, value, hint }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-ink">{value ?? 0}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </article>
  );
}

function Section({ title, description, actions, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
};

export default function ControlCenter() {
  const { user } = useApp();
  const isMainAdmin = user?.accountType === "STAFF" && user?.role === "ADMIN";
  const availableOperationalStatuses = isMainAdmin
    ? operationalStatuses
    : operationalStatuses.filter((status) => status !== "PERMANENTLY_BLOCKED");
  const [tab, setTab] = useState("escalations");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overview, setOverview] = useState({});
  const [escalations, setEscalations] = useState([]);
  const [escalationRules, setEscalationRules] = useState([]);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportBookings, setSupportBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [performance, setPerformance] = useState([]);
  const [performanceDays, setPerformanceDays] = useState(30);
  const [garageStatusDrafts, setGarageStatusDrafts] = useState({});
  const [coverage, setCoverage] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [availabilityRules, setAvailabilityRules] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [services, setServices] = useState([]);
  const [cities, setCities] = useState([]);
  const [garages, setGarages] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({
    city: "",
    serviceId: "",
    vehicleBrand: "ALL",
    vehicleModel: "",
    fuelType: "",
    minPrice: "",
    maxPrice: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  });
  const [ruleForm, setRuleForm] = useState({
    serviceId: "",
    cityId: "",
    garageId: "",
    vehicleBrand: "",
    vehicleModel: "",
    fuelType: "",
    dayOfWeek: "",
    startTime: "",
    endTime: "",
    effect: "DENY",
    reason: "",
    isActive: true,
  });

  const showError = (err, fallback) => setError(err?.response?.data?.message || err?.message || fallback);
  const clearMessages = () => { setError(""); setSuccess(""); };

  const load = async () => {
    setLoading(true);
    clearMessages();
    try {
      const [overviewData, escalationData, rulesData, performanceData, coverageData, scheduleData, availabilityData, auditData, serviceData, cityData, garageData] = await Promise.all([
        adminApi.getControlCenterOverview(),
        adminApi.getEscalations(),
        adminApi.getEscalationRules(),
        adminApi.getGaragePerformance({ days: performanceDays }),
        adminApi.getPricingCoverage(),
        adminApi.getPriceSchedules(),
        adminApi.getAvailabilityRules(),
        adminApi.getAuditLogs({ limit: 150 }),
        adminApi.getAssignableServices(),
        cityApi.getAdminCities({ includeInactive: true }),
        adminApi.getGarages(),
      ]);
      setOverview(overviewData || {});
      setEscalations(escalationData || []);
      setEscalationRules(rulesData || []);
      setPerformance(performanceData || []);
      setCoverage(coverageData || null);
      setSchedules(scheduleData || []);
      setAvailabilityRules(availabilityData || []);
      setAuditLogs(auditData || []);
      setServices(serviceData || []);
      setCities(cityData || []);
      setGarages(Array.isArray(garageData) ? garageData : garageData?.items || []);
    } catch (err) {
      showError(err, "Unable to load the admin control center");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refreshPerformance = async () => {
    setBusy("performance");
    clearMessages();
    try {
      setPerformance(await adminApi.getGaragePerformance({ days: performanceDays }));
    } catch (err) {
      showError(err, "Unable to refresh garage performance");
    } finally {
      setBusy("");
    }
  };

  const searchBookings = async (event) => {
    event?.preventDefault();
    if (!supportSearch.trim()) return;
    setBusy("support-search");
    clearMessages();
    try {
      setSupportBookings(await adminApi.searchSupportBookings(supportSearch.trim()));
    } catch (err) {
      showError(err, "Unable to search bookings");
    } finally {
      setBusy("");
    }
  };

  const notifyBooking = async (bookingId, target) => {
    setBusy(`notify:${bookingId}:${target}`);
    clearMessages();
    try {
      await adminApi.resendBookingNotification(bookingId, { target });
      setSuccess(`Booking notification sent to ${target.toLowerCase()}.`);
    } catch (err) {
      showError(err, "Unable to send booking notification");
    } finally {
      setBusy("");
    }
  };

  const updateEscalation = async (item, status) => {
    setBusy(`escalation:${item.id}`);
    clearMessages();
    try {
      await adminApi.updateEscalation(item.id, { status, note: status === "RESOLVED" ? "Resolved from Admin Control Center" : "" });
      setEscalations(await adminApi.getEscalations());
      setOverview(await adminApi.getControlCenterOverview());
      setSuccess(`Escalation ${status.toLowerCase()}.`);
    } catch (err) {
      showError(err, "Unable to update escalation");
    } finally {
      setBusy("");
    }
  };

  const saveEscalationRule = async (rule) => {
    setBusy(`rule:${rule.id}`);
    clearMessages();
    try {
      await adminApi.updateEscalationRule(rule.id, {
        enabled: rule.enabled,
        thresholdMinutes: Number(rule.thresholdMinutes),
        severity: rule.severity,
      });
      setEscalationRules(await adminApi.getEscalationRules());
      setSuccess("Escalation rule updated.");
    } catch (err) {
      showError(err, "Unable to update escalation rule");
    } finally {
      setBusy("");
    }
  };

  const saveGarageStatus = async (garage) => {
    const draft = garageStatusDrafts[garage.id] || { status: garage.operationalStatus, reason: garage.suspensionReason || "", suspendedUntil: "" };
    setBusy(`garage:${garage.id}`);
    clearMessages();
    try {
      await adminApi.setGarageOperationalStatus(garage.id, {
        ...draft,
        suspendedUntil: draft.status === "TEMPORARILY_SUSPENDED" && draft.suspendedUntil
          ? new Date(draft.suspendedUntil).toISOString()
          : null,
      });
      await refreshPerformance();
      setOverview(await adminApi.getControlCenterOverview());
      setSuccess(`${garage.name} status updated.`);
    } catch (err) {
      showError(err, "Unable to update garage status");
    } finally {
      setBusy("");
    }
  };

  const handleCsvFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clearMessages();
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("CSV must contain a header row and at least one data row");
      setImportRows(rows);
      const preview = await adminApi.importPriceRanges(rows, true);
      setImportPreview(preview);
      if (preview.valid) setSuccess(`${preview.rows} rows are valid and ready to import.`);
    } catch (err) {
      setImportRows([]);
      setImportPreview(null);
      showError(err, "Unable to read CSV");
    }
  };

  const commitImport = async () => {
    setBusy("import");
    clearMessages();
    try {
      const result = await adminApi.importPriceRanges(importRows, false);
      setSuccess(`${result.imported} price ranges imported.`);
      setImportRows([]);
      setImportPreview(null);
      setCoverage(await adminApi.getPricingCoverage());
    } catch (err) {
      showError(err, "Unable to import price ranges");
    } finally {
      setBusy("");
    }
  };

  const exportCsv = async () => {
    setBusy("export");
    clearMessages();
    try {
      const response = await adminApi.exportPriceRangesCsv();
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rovauto-price-ranges-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(err, "Unable to export price ranges");
    } finally {
      setBusy("");
    }
  };

  const createSchedule = async (event) => {
    event.preventDefault();
    setBusy("schedule-create");
    clearMessages();
    try {
      await adminApi.createPriceSchedule({
        ...scheduleForm,
        minPrice: Number(scheduleForm.minPrice),
        maxPrice: Number(scheduleForm.maxPrice),
        startsAt: new Date(scheduleForm.startsAt).toISOString(),
        endsAt: scheduleForm.endsAt ? new Date(scheduleForm.endsAt).toISOString() : null,
      });
      setScheduleForm({ city: "", serviceId: "", vehicleBrand: "ALL", vehicleModel: "", fuelType: "", minPrice: "", maxPrice: "", startsAt: "", endsAt: "", isActive: true });
      setSchedules(await adminApi.getPriceSchedules());
      setSuccess("Price schedule created.");
    } catch (err) {
      showError(err, "Unable to create price schedule");
    } finally {
      setBusy("");
    }
  };

  const cancelSchedule = async (id) => {
    setBusy(`schedule:${id}`);
    clearMessages();
    try {
      await adminApi.cancelPriceSchedule(id);
      setSchedules(await adminApi.getPriceSchedules());
      setSuccess("Price schedule cancelled.");
    } catch (err) {
      showError(err, "Unable to cancel price schedule");
    } finally {
      setBusy("");
    }
  };

  const createAvailabilityRule = async (event) => {
    event.preventDefault();
    setBusy("availability-create");
    clearMessages();
    try {
      await adminApi.createAvailabilityRule({
        ...ruleForm,
        dayOfWeek: ruleForm.dayOfWeek === "" ? null : Number(ruleForm.dayOfWeek),
      });
      setRuleForm({ serviceId: "", cityId: "", garageId: "", vehicleBrand: "", vehicleModel: "", fuelType: "", dayOfWeek: "", startTime: "", endTime: "", effect: "DENY", reason: "", isActive: true });
      setAvailabilityRules(await adminApi.getAvailabilityRules());
      setOverview(await adminApi.getControlCenterOverview());
      setSuccess("Availability rule created.");
    } catch (err) {
      showError(err, "Unable to create availability rule");
    } finally {
      setBusy("");
    }
  };

  const toggleAvailabilityRule = async (rule) => {
    setBusy(`availability:${rule.id}`);
    clearMessages();
    try {
      await adminApi.updateAvailabilityRule(rule.id, { isActive: !rule.isActive });
      setAvailabilityRules(await adminApi.getAvailabilityRules());
    } catch (err) {
      showError(err, "Unable to update availability rule");
    } finally {
      setBusy("");
    }
  };

  const deleteAvailabilityRule = async (rule) => {
    if (!window.confirm(`Delete availability rule for ${rule.service?.name || "this service"}?`)) return;
    setBusy(`availability:${rule.id}`);
    clearMessages();
    try {
      await adminApi.deleteAvailabilityRule(rule.id);
      setAvailabilityRules(await adminApi.getAvailabilityRules());
      setSuccess("Availability rule deleted.");
    } catch (err) {
      showError(err, "Unable to delete availability rule");
    } finally {
      setBusy("");
    }
  };

  const sortedPerformance = useMemo(() => [...performance].sort((a, b) => b.receivedRequests - a.receivedRequests), [performance]);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted"><FiShield /> Admin operations</div>
            <h1 className="mt-2 text-2xl font-extrabold text-ink">Control Center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Handle escalations, customer booking support, garage risk controls, pricing coverage, imports, schedules, and service availability from one admin-only workspace.</p>
          </div>
          <button onClick={load} disabled={loading} className={`${buttonClass} border border-line bg-white text-ink hover:bg-bg-soft`}><FiRefreshCw className={loading ? "animate-spin" : ""} />Refresh all</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Open escalations" value={overview.openEscalations} />
          <StatCard label="Restricted garages" value={overview.suspendedGarages} />
          <StatCard label="Active price schedules" value={overview.scheduledPrices} />
          <StatCard label="Availability rules" value={overview.activeAvailabilityRules} />
          <StatCard label="Admin actions (24h)" value={overview.recentAuditLogs} />
        </div>
      </header>

      {(error || success) && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {error ? <FiAlertCircle className="mt-0.5 shrink-0" /> : <FiCheck className="mt-0.5 shrink-0" />}
          <span>{error || success}</span>
          <button className="ml-auto" onClick={clearMessages}><FiX /></button>
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-line bg-white p-2 shadow-sm">
        {tabs.map(([value, label, Icon]) => (
          <button key={value} onClick={() => setTab(value)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${tab === value ? "bg-ink text-white" : "text-muted hover:bg-bg-soft hover:text-ink"}`}>
            <Icon />{label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center text-sm text-muted">Loading admin controls...</div>
      ) : (
        <>
          {tab === "escalations" && (
            <div className="space-y-5">
              <Section title="Action Required" description="Rules are evaluated whenever this page or the admin overview is loaded.">
                <div className="space-y-3">
                  {escalations.length === 0 && <p className="rounded-xl bg-bg-soft p-6 text-center text-sm text-muted">No active booking escalations.</p>}
                  {escalations.map((item) => (
                    <article key={item.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><Badge value={item.severity} /><Badge value={item.status} /></div>
                          <h3 className="mt-2 font-extrabold text-ink">{item.title} · #{item.booking?.bookingCode}</h3>
                          <p className="mt-1 text-sm text-muted">{item.detail}</p>
                          <p className="mt-2 text-xs text-muted">{item.booking?.user?.name} · {item.booking?.user?.phone || item.booking?.user?.email || "No contact"} · {formatStatus(item.booking?.status)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setSelectedBookingId(item.bookingId)} className={`${buttonClass} border border-line bg-white text-ink`}><FiEye />Open booking</button>
                          {item.status !== "ACKNOWLEDGED" && <button disabled={busy === `escalation:${item.id}`} onClick={() => updateEscalation(item, "ACKNOWLEDGED")} className={`${buttonClass} bg-amber-100 text-amber-900`}><FiClock />Acknowledge</button>}
                          {item.status !== "RESOLVED" && <button disabled={busy === `escalation:${item.id}`} onClick={() => updateEscalation(item, "RESOLVED")} className={`${buttonClass} bg-green-600 text-white`}><FiCheck />Resolve</button>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </Section>

              <Section title="Escalation rules" description="Change how long the system waits before creating an admin alert.">
                <div className="grid gap-3 lg:grid-cols-2">
                  {escalationRules.map((rule) => (
                    <article key={rule.id} className="rounded-xl border border-line p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-bold text-ink">{rule.label}</h3><p className="mt-1 text-xs text-muted">{rule.key}</p></div>
                        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={rule.enabled} onChange={(event) => setEscalationRules((list) => list.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item))} />Enabled</label>
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input type="number" min="1" max="10080" value={rule.thresholdMinutes} onChange={(event) => setEscalationRules((list) => list.map((item) => item.id === rule.id ? { ...item, thresholdMinutes: event.target.value } : item))} className={fieldClass} />
                        <select value={rule.severity} onChange={(event) => setEscalationRules((list) => list.map((item) => item.id === rule.id ? { ...item, severity: event.target.value } : item))} className={fieldClass}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
                        <button disabled={busy === `rule:${rule.id}`} onClick={() => saveEscalationRule(rule)} className={`${buttonClass} bg-ink text-white`}><FiSave /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {tab === "support" && (
            <Section title="Customer support booking panel" description="Search by booking code, customer name, email, phone, or vehicle registration.">
              <form onSubmit={searchBookings} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1"><FiSearch className="absolute left-3 top-3 text-muted" /><input value={supportSearch} onChange={(event) => setSupportSearch(event.target.value)} placeholder="ROV booking code, phone, email, registration..." className={`${fieldClass} w-full pl-9`} /></div>
                <button disabled={busy === "support-search" || !supportSearch.trim()} className={`${buttonClass} bg-ink text-white`}><FiSearch />Search</button>
              </form>
              <div className="mt-5 space-y-3">
                {supportBookings.map((booking) => (
                  <article key={booking.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-ink">#{booking.bookingCode}</h3><Badge value={booking.status} />{booking.escalations?.length > 0 && <Badge value="HIGH" />}</div>
                        <p className="mt-2 text-sm text-muted">{booking.user?.name} · {booking.user?.phone || booking.user?.email} · {booking.vehicle?.brand} {booking.vehicle?.model}</p>
                        <p className="mt-1 text-xs text-muted">Garage: {booking.garage?.name || "Unassigned"} · Payment: {booking.payment?.status || "Not created"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedBookingId(booking.id)} className={`${buttonClass} border border-line bg-white text-ink`}><FiEye />Manage</button>
                        <button disabled={busy.startsWith(`notify:${booking.id}`)} onClick={() => notifyBooking(booking.id, "CUSTOMER")} className={`${buttonClass} bg-blue-50 text-blue-700`}><FiBell />Customer</button>
                        <button disabled={!booking.garage || busy.startsWith(`notify:${booking.id}`)} onClick={() => notifyBooking(booking.id, "GARAGE")} className={`${buttonClass} bg-amber-50 text-amber-800`}><FiBell />Garage</button>
                      </div>
                    </div>
                  </article>
                ))}
                {supportSearch && supportBookings.length === 0 && busy !== "support-search" && <p className="rounded-xl bg-bg-soft p-6 text-center text-sm text-muted">No matching bookings.</p>}
              </div>
            </Section>
          )}

          {tab === "garages" && (
            <Section title="Garage performance scorecard" description="Operational status affects new booking discovery and acceptance, while existing bookings remain accessible." actions={<div className="flex gap-2"><select value={performanceDays} onChange={(event) => setPerformanceDays(Number(event.target.value))} className={fieldClass}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select><button onClick={refreshPerformance} className={`${buttonClass} border border-line bg-white text-ink`}><FiRefreshCw className={busy === "performance" ? "animate-spin" : ""} /></button></div>}>
              <div className="overflow-x-auto">
                <table className="min-w-[1250px] w-full text-left text-sm">
                  <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted"><th className="px-2 py-3">Garage</th><th className="px-2">Status</th><th className="px-2">Requests</th><th className="px-2">Acceptance</th><th className="px-2">Completion</th><th className="px-2">Cancellation</th><th className="px-2">Response</th><th className="px-2">Rating</th><th className="px-2">Complaints</th><th className="px-2">Revenue</th><th className="px-2">Control</th></tr></thead>
                  <tbody>
                    {sortedPerformance.map((garage) => {
                      const draft = garageStatusDrafts[garage.id] || { status: garage.operationalStatus, reason: garage.suspensionReason || "", suspendedUntil: garage.suspendedUntil ? new Date(garage.suspendedUntil).toISOString().slice(0, 16) : "" };
                      return (
                        <tr key={garage.id} className="border-b border-line align-top">
                          <td className="px-2 py-3"><p className="font-bold text-ink">{garage.name}</p><p className="text-xs text-muted">{garage.city}</p></td>
                          <td className="px-2 py-3"><Badge value={garage.operationalStatus} /></td>
                          <td className="px-2 py-3">{garage.acceptedRequests}/{garage.receivedRequests}</td>
                          <td className="px-2 py-3 font-bold">{garage.acceptanceRate}%</td>
                          <td className="px-2 py-3">{garage.completedBookings}/{garage.assignedBookings} ({garage.completionRate}%)</td>
                          <td className="px-2 py-3">{garage.cancellationRate}%</td>
                          <td className="px-2 py-3">{garage.avgResponseMinutes} min</td>
                          <td className="px-2 py-3">{Number(garage.ratingAvg || 0).toFixed(1)} ({garage.ratingCount})</td>
                          <td className="px-2 py-3">{garage.complaintCount}</td>
                          <td className="px-2 py-3 font-bold">{formatRupees(garage.serviceRevenue)}</td>
                          <td className="px-2 py-3">
                            <div className="grid min-w-[240px] gap-2">
                              <select value={draft.status} onChange={(event) => setGarageStatusDrafts((current) => ({ ...current, [garage.id]: { ...draft, status: event.target.value } }))} className={fieldClass}>{availableOperationalStatuses.map((status) => <option key={status}>{status}</option>)}</select>
                              {draft.status === "TEMPORARILY_SUSPENDED" && <input type="datetime-local" value={draft.suspendedUntil} onChange={(event) => setGarageStatusDrafts((current) => ({ ...current, [garage.id]: { ...draft, suspendedUntil: event.target.value } }))} className={fieldClass} />}
                              {draft.status !== "ACTIVE" && <input value={draft.reason} onChange={(event) => setGarageStatusDrafts((current) => ({ ...current, [garage.id]: { ...draft, reason: event.target.value } }))} placeholder="Reason" className={fieldClass} />}
                              <button disabled={busy === `garage:${garage.id}`} onClick={() => saveGarageStatus(garage)} className={`${buttonClass} bg-ink text-white`}><FiSave />Apply</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {tab === "pricing" && (
            <div className="space-y-5">
              <Section title="Price-range coverage" description="Find services, cities, brands, and models that do not yet have usable pricing." actions={<div className="flex gap-2"><button onClick={exportCsv} disabled={busy === "export"} className={`${buttonClass} border border-line bg-white text-ink`}><FiDownload />Export CSV</button><label className={`${buttonClass} cursor-pointer bg-ink text-white`}><FiUpload />Choose CSV<input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" /></label></div>}>
                {coverage && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active ranges" value={coverage.totals?.activeRanges} /><StatCard label="Missing city/service" value={coverage.totals?.missingCityServicePairs} /><StatCard label="Services without pricing" value={coverage.totals?.servicesWithoutAnyRange} /><StatCard label="Models without coverage" value={coverage.totals?.modelsWithoutCoverage} /></div>}
                {importPreview && <div className={`mt-4 rounded-xl border p-4 ${importPreview.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}><p className="font-bold">CSV validation: {importPreview.valid ? "Ready" : "Errors found"}</p><p className="mt-1 text-sm">{importPreview.rows} rows checked.</p>{importPreview.errors?.slice(0, 12).map((item) => <p key={`${item.row}:${item.message}`} className="mt-1 text-sm text-red-700">Row {item.row}: {item.message}</p>)}{importPreview.valid && <button onClick={commitImport} disabled={busy === "import"} className={`${buttonClass} mt-3 bg-green-700 text-white`}><FiUpload />Import {importPreview.rows} rows</button>}</div>}
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl bg-bg-soft p-4"><h3 className="font-bold text-ink">Services without any range</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{coverage?.servicesWithoutAnyRange?.slice(0, 100).map((item) => <p key={item.id} className="text-sm">{item.category} · {item.name}</p>)}</div></div>
                  <div className="rounded-xl bg-bg-soft p-4"><h3 className="font-bold text-ink">Missing city/service pairs</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{coverage?.missingCityServices?.slice(0, 100).map((item) => <p key={`${item.city}:${item.serviceId}`} className="text-sm">{item.city} · {item.serviceName}</p>)}</div></div>
                  <div className="rounded-xl bg-bg-soft p-4"><h3 className="font-bold text-ink">Uncovered models</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{coverage?.missingModels?.slice(0, 100).map((item) => <p key={item.id} className="text-sm">{item.brand} · {item.name}</p>)}</div></div>
                </div>
              </Section>

              <Section title="Scheduled pricing" description="Apply a price automatically and optionally restore the previous price after the end date.">
                <form onSubmit={createSchedule} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <select required value={scheduleForm.city} onChange={(event) => setScheduleForm({ ...scheduleForm, city: event.target.value })} className={fieldClass}><option value="">Select city</option>{cities.filter((city) => city.isActive).map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}</select>
                  <select required value={scheduleForm.serviceId} onChange={(event) => setScheduleForm({ ...scheduleForm, serviceId: event.target.value })} className={fieldClass}><option value="">Select service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.category?.name} · {service.name}</option>)}</select>
                  <input required value={scheduleForm.vehicleBrand} onChange={(event) => setScheduleForm({ ...scheduleForm, vehicleBrand: event.target.value })} placeholder="Vehicle brand or ALL" className={fieldClass} />
                  <input value={scheduleForm.vehicleModel} onChange={(event) => setScheduleForm({ ...scheduleForm, vehicleModel: event.target.value })} placeholder="Vehicle model or ALL" className={fieldClass} />
                  <select value={scheduleForm.fuelType} onChange={(event) => setScheduleForm({ ...scheduleForm, fuelType: event.target.value })} className={fieldClass}>{fuelTypes.map((fuel) => <option key={fuel} value={fuel}>{fuel || "Any fuel"}</option>)}</select>
                  <input required type="number" min="0" value={scheduleForm.minPrice} onChange={(event) => setScheduleForm({ ...scheduleForm, minPrice: event.target.value })} placeholder="Minimum price" className={fieldClass} />
                  <input required type="number" min="0" value={scheduleForm.maxPrice} onChange={(event) => setScheduleForm({ ...scheduleForm, maxPrice: event.target.value })} placeholder="Maximum price" className={fieldClass} />
                  <input required type="datetime-local" value={scheduleForm.startsAt} onChange={(event) => setScheduleForm({ ...scheduleForm, startsAt: event.target.value })} className={fieldClass} />
                  <input type="datetime-local" value={scheduleForm.endsAt} onChange={(event) => setScheduleForm({ ...scheduleForm, endsAt: event.target.value })} className={fieldClass} />
                  <button disabled={busy === "schedule-create"} className={`${buttonClass} bg-ink text-white xl:col-span-2`}><FiClock />Create schedule</button>
                </form>
                <div className="mt-5 overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase text-muted"><th className="py-3">Service</th><th>Scope</th><th>Price</th><th>Starts</th><th>Ends</th><th>Status</th><th></th></tr></thead><tbody>{schedules.map((item) => <tr key={item.id} className="border-b border-line"><td className="py-3 font-bold">{item.service?.name}</td><td>{item.city} · {item.vehicleBrand || "ALL"} {item.vehicleModel ? `· ${item.vehicleModel}` : ""}</td><td>{formatRupees(item.minPrice)}–{formatRupees(item.maxPrice)}</td><td>{formatDateTime(item.startsAt)}</td><td>{formatDateTime(item.endsAt)}</td><td><Badge value={item.status} /></td><td>{!["CANCELLED", "EXPIRED"].includes(item.status) && <button disabled={busy === `schedule:${item.id}`} onClick={() => cancelSchedule(item.id)} className="text-sm font-bold text-red-600">Cancel</button>}</td></tr>)}</tbody></table></div>
              </Section>
            </div>
          )}

          {tab === "availability" && (
            <div className="space-y-5">
              <Section title="Create service availability rule" description="Use ALLOW rules to restrict a service to matching scopes, or DENY rules to block matching scopes.">
                <form onSubmit={createAvailabilityRule} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <select required value={ruleForm.serviceId} onChange={(event) => setRuleForm({ ...ruleForm, serviceId: event.target.value })} className={fieldClass}><option value="">Select service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.category?.name} · {service.name}</option>)}</select>
                  <select value={ruleForm.cityId} onChange={(event) => setRuleForm({ ...ruleForm, cityId: event.target.value })} className={fieldClass}><option value="">All cities</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select>
                  <select value={ruleForm.garageId} onChange={(event) => setRuleForm({ ...ruleForm, garageId: event.target.value })} className={fieldClass}><option value="">All garages</option>{garages.map((garage) => <option key={garage.id} value={garage.id}>{garage.name} · {garage.city}</option>)}</select>
                  <select value={ruleForm.effect} onChange={(event) => setRuleForm({ ...ruleForm, effect: event.target.value })} className={fieldClass}><option value="DENY">DENY matching scope</option><option value="ALLOW">ALLOW only matching scope</option></select>
                  <input value={ruleForm.vehicleBrand} onChange={(event) => setRuleForm({ ...ruleForm, vehicleBrand: event.target.value })} placeholder="Vehicle brand (optional)" className={fieldClass} />
                  <input value={ruleForm.vehicleModel} onChange={(event) => setRuleForm({ ...ruleForm, vehicleModel: event.target.value })} placeholder="Vehicle model (optional)" className={fieldClass} />
                  <select value={ruleForm.fuelType} onChange={(event) => setRuleForm({ ...ruleForm, fuelType: event.target.value })} className={fieldClass}>{fuelTypes.map((fuel) => <option key={fuel} value={fuel}>{fuel || "Any fuel"}</option>)}</select>
                  <select value={ruleForm.dayOfWeek} onChange={(event) => setRuleForm({ ...ruleForm, dayOfWeek: event.target.value })} className={fieldClass}><option value="">Every day</option>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select>
                  <input type="time" value={ruleForm.startTime} onChange={(event) => setRuleForm({ ...ruleForm, startTime: event.target.value })} className={fieldClass} />
                  <input type="time" value={ruleForm.endTime} onChange={(event) => setRuleForm({ ...ruleForm, endTime: event.target.value })} className={fieldClass} />
                  <input value={ruleForm.reason} onChange={(event) => setRuleForm({ ...ruleForm, reason: event.target.value })} placeholder="Customer-facing reason/internal context" className={`${fieldClass} xl:col-span-2`} />
                  <button disabled={busy === "availability-create"} className={`${buttonClass} bg-ink text-white xl:col-span-2`}><FiSave />Create rule</button>
                </form>
              </Section>
              <Section title="Configured availability rules" description="Inactive rules remain stored but are not enforced.">
                <div className="space-y-3">{availabilityRules.map((rule) => <article key={rule.id} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex gap-2"><Badge value={rule.effect} /><Badge value={rule.isActive ? "ACTIVE" : "CANCELLED"} /></div><h3 className="mt-2 font-bold text-ink">{rule.service?.category?.name} · {rule.service?.name}</h3><p className="mt-1 text-sm text-muted">{rule.city?.name || "All cities"} · {rule.garage?.name || "All garages"} · {rule.vehicleBrand || "Any brand"} · {rule.vehicleModel || "Any model"} · {rule.fuelType || "Any fuel"}</p><p className="mt-1 text-xs text-muted">{rule.dayOfWeek === null ? "Every day" : days[rule.dayOfWeek]} {rule.startTime || rule.endTime ? `· ${rule.startTime || "00:00"}–${rule.endTime || "23:59"}` : ""} {rule.reason ? `· ${rule.reason}` : ""}</p></div><div className="flex gap-2"><button disabled={busy === `availability:${rule.id}`} onClick={() => toggleAvailabilityRule(rule)} className={`${buttonClass} border border-line bg-white text-ink`}>{rule.isActive ? <FiSlash /> : <FiCheck />}{rule.isActive ? "Disable" : "Enable"}</button><button disabled={busy === `availability:${rule.id}`} onClick={() => deleteAvailabilityRule(rule)} className={`${buttonClass} bg-red-50 text-red-700`}><FiTrash2 /></button></div></div></article>)}</div>
              </Section>
            </div>
          )}

          {tab === "audit" && (
            <Section title="Admin audit logs" description="Every successful and failed admin mutation is recorded with actor, route, status, IP, device, and sanitized request details.">
              <div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase text-muted"><th className="py-3">Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Route</th><th>Status</th><th>IP</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id} className="border-b border-line"><td className="py-3">{formatDateTime(log.createdAt)}</td><td><p className="font-bold">{log.actorName || "Unknown"}</p><p className="text-xs text-muted">{log.actorRole}</p></td><td><Badge value={log.action} /></td><td>{log.resource}{log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}</td><td className="max-w-[320px] truncate" title={log.path}>{log.method} {log.path}</td><td>{log.statusCode}</td><td>{log.ipAddress || "-"}</td></tr>)}</tbody></table></div>
            </Section>
          )}
        </>
      )}

      {selectedBookingId && <BookingManagementModal bookingId={selectedBookingId} isAdmin onClose={() => setSelectedBookingId("")} onUpdated={() => { searchBookings(); load(); }} />}
    </div>
  );
}
