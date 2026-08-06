import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { customerSupportApi } from "@/api/customerSupport";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiPhoneCall,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

const formatDuration = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}m ${safe % 60}s`;
};

const statusClass = (status) => {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  if (status === "IN_CALL") return "bg-blue-100 text-blue-700";
  if (status === "CLAIMED") return "bg-violet-100 text-violet-700";
  return "bg-amber-100 text-amber-800";
};

export default function VerificationLeads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const selectedId = searchParams.get("lead");

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const result = await customerSupportApi.getVerificationLeads({
        status: status || undefined,
        limit: 100,
      });
      setLeads(Array.isArray(result) ? result : []);
      const nextSelected = selectedId
        ? (Array.isArray(result) ? result : []).find((lead) => lead.id === selectedId)
        : null;
      if (nextSelected) {
        setSelected(nextSelected);
        setNotes(nextSelected.verificationNotes || "");
      } else if (selected?.id) {
        const refreshed = (Array.isArray(result) ? result : []).find((lead) => lead.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load verification leads.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load({ silent: true }), 10000);
    return () => window.clearInterval(poll);
  }, [status, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const openLead = (lead) => {
    setSelected(lead);
    setNotes(lead.verificationNotes || "");
    setSearchParams({ lead: lead.id });
  };

  const runAction = async (key, action) => {
    try {
      setBusy(key);
      setError("");
      const result = await action();
      setSelected(result);
      setNotes(result.verificationNotes || notes);
      await load({ silent: true });
      return result;
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Action could not be completed.");
      return null;
    } finally {
      setBusy("");
    }
  };

  const claim = () => runAction("claim", () => customerSupportApi.claimVerificationLead(selected.id));

  const callCustomer = async () => {
    const result = await runAction("call", () => customerSupportApi.startVerificationCall(selected.id));
    const phone = result?.user?.phone || selected?.user?.phone;
    if (result && phone) window.location.href = `tel:${phone}`;
  };

  const approve = async () => {
    await runAction("approve", () => customerSupportApi.approveVerificationLead(selected.id, { notes: notes.trim() || null }));
  };

  const reject = async () => {
    const confirmed = window.confirm("Reject this booking as suspicious? The booking will be cancelled and admin will be notified.");
    if (!confirmed) return;
    await runAction("reject", () => customerSupportApi.rejectVerificationLead(selected.id, { notes: notes.trim() || null }));
  };

  const liveCallSeconds = useMemo(() => {
    if (!selected?.callStartedAt) return null;
    const end = selected.callEndedAt ? new Date(selected.callEndedAt).getTime() : now;
    return Math.max(0, Math.floor((end - new Date(selected.callStartedAt).getTime()) / 1000));
  }, [selected?.callStartedAt, selected?.callEndedAt, now]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">First-booking acquisition</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink"><FiShield /> Verification leads</h1>
            <p className="mt-2 text-sm leading-6 text-muted">Claim genuine first-booking customers, call them, and approve garage search. The first successful claim owns the lead.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink hover:bg-bg-soft disabled:opacity-50">
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      {error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><FiAlertTriangle className="mt-0.5 shrink-0" /> {error}</div>}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-extrabold text-ink">Lead queue</h2><p className="text-xs text-muted">Newest leads appear first.</p></div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none">
              <option value="">All statuses</option>
              <option value="PENDING">Unclaimed</option>
              <option value="CLAIMED">Claimed</option>
              <option value="IN_CALL">In call</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="mt-4 grid max-h-[68vh] gap-3 overflow-y-auto pr-1">
            {loading && leads.length === 0 ? <p className="rounded-xl bg-bg-soft p-5 text-center text-sm text-muted">Loading leads...</p> : leads.length === 0 ? <p className="rounded-xl bg-bg-soft p-5 text-center text-sm text-muted">No verification leads in this queue.</p> : leads.map((lead) => (
              <button key={lead.id} type="button" onClick={() => openLead(lead)} className={`rounded-2xl border p-4 text-left transition ${selected?.id === lead.id ? "border-ink bg-bg-soft shadow-sm" : "border-line bg-white hover:border-ink/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-extrabold text-ink">{lead.user?.name || "Customer"}</p><p className="mt-1 text-xs text-muted">{lead.booking?.bookingCode} · {lead.user?.phone || "No phone"}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusClass(lead.status)}`}>{lead.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">{lead.booking?.vehicle?.brand} {lead.booking?.vehicle?.model}</p>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted"><span>Up to ₹{Number(lead.booking?.totalServiceMaxAmount || 0).toLocaleString("en-IN")}</span><span>{formatDate(lead.createdAt)}</span></div>
                <p className="mt-2 text-xs font-semibold text-muted">{lead.claimedBy ? `Claimed by ${lead.claimedBy.name}` : "Available to claim"}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-6">
          {!selected ? (
            <div className="grid min-h-[480px] place-items-center text-center"><div><FiUserCheck className="mx-auto text-5xl text-muted" /><h2 className="mt-4 text-xl font-extrabold text-ink">Select a lead</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Open a customer lead to claim it, start the phone timer, and record the decision.</p></div></div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-muted">{selected.booking?.bookingCode}</p><h2 className="mt-1 text-2xl font-black text-ink">{selected.user?.name}</h2><p className="mt-1 text-sm text-muted">{selected.user?.phone} · {selected.user?.email}</p></div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${statusClass(selected.status)}`}>{selected.status.replaceAll("_", " ")}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-bg-soft p-4"><p className="text-xs text-muted">Vehicle</p><p className="mt-1 font-bold text-ink">{selected.booking?.vehicle?.brand} {selected.booking?.vehicle?.model}</p><p className="mt-1 text-xs text-muted">{selected.booking?.vehicle?.registrationNumber || "Registration not provided"}</p></div>
                <div className="rounded-xl bg-bg-soft p-4"><p className="text-xs text-muted">Maximum estimate</p><p className="mt-1 text-xl font-black text-ink">₹{Number(selected.booking?.totalServiceMaxAmount || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-xs font-semibold text-emerald-700">Platform fee waived</p></div>
              </div>

              <div className="rounded-xl border border-line p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Service address</p><p className="mt-2 text-sm leading-6 text-ink">{selected.booking?.customerAddress || "Not provided"}</p></div>

              <div className="rounded-xl border border-line p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Call timer</p><p className="mt-1 text-2xl font-black text-ink">{liveCallSeconds === null ? "Not started" : formatDuration(liveCallSeconds)}</p></div><FiClock className="text-2xl text-muted" /></div><p className="mt-2 text-xs leading-5 text-muted">The timer starts when Call customer is clicked and stops when this lead is approved or rejected.</p></div>

              <div><label className="text-sm font-bold text-ink" htmlFor="lead-notes">Verification notes <span className="font-normal text-muted">(optional)</span></label><textarea id="lead-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={3000} rows={4} disabled={!selected.canAct} placeholder="Add useful verification context for support/admin records..." className="mt-2 w-full resize-y rounded-xl border border-line p-3 text-sm outline-none focus:border-ink disabled:bg-bg-soft disabled:text-muted" /></div>

              {selected.claimedBy && !selected.assignedToMe && !["APPROVED", "REJECTED"].includes(selected.status) && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><FiLock className="mt-0.5 shrink-0" /> This lead is owned by {selected.claimedBy.name}. Only that agent can call or decide it.</div>}

              <div className="grid gap-3 sm:grid-cols-2">
                {selected.canClaim && <button type="button" onClick={claim} disabled={Boolean(busy)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-black text-white disabled:opacity-50 sm:col-span-2"><FiUserCheck /> {busy === "claim" ? "Claiming..." : "Claim lead"}</button>}
                {selected.canAct && <button type="button" onClick={callCustomer} disabled={Boolean(busy) || !selected.user?.phone} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50 sm:col-span-2"><FiPhoneCall /> {busy === "call" ? "Starting timer..." : selected.callStartedAt ? "Call customer again" : "Call customer"}</button>}
                {selected.canAct && <button type="button" onClick={approve} disabled={Boolean(busy) || !selected.callStartedAt} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50"><FiCheckCircle /> {busy === "approve" ? "Approving..." : "Approve"}</button>}
                {selected.canAct && <button type="button" onClick={reject} disabled={Boolean(busy) || !selected.callStartedAt} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 disabled:opacity-50"><FiXCircle /> {busy === "reject" ? "Rejecting..." : "Reject suspicious"}</button>}
              </div>

              {["APPROVED", "REJECTED"].includes(selected.status) && <div className={`rounded-xl p-4 text-sm ${selected.status === "APPROVED" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}><p className="font-bold">Lead {selected.status.toLowerCase()}.</p><p className="mt-1">Call duration: {formatDuration(selected.callDurationSeconds)} · Closed {formatDate(selected.approvedAt || selected.rejectedAt)}</p></div>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
