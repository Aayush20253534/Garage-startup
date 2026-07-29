import { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiHome,
  FiRefreshCw,
  FiSave,
  FiToggleLeft,
  FiToggleRight,
  FiUsers,
} from "react-icons/fi";

import { adminApi } from "@/api/admin";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const controlClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-ink";

const emptyState = {
  enabled: false,
  extraUsers: 0,
  extraGarages: 0,
  realUsers: 0,
  realGarages: 0,
  displayUsers: 0,
  displayGarages: 0,
  updatedAt: null,
  updatedByStaffName: null,
};

export default function PseudoData() {
  const [data, setData] = useState(emptyState);
  const [enabled, setEnabled] = useState(false);
  const [extraUsers, setExtraUsers] = useState(0);
  const [extraGarages, setExtraGarages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyResponse = (payload) => {
    const next = { ...emptyState, ...(payload || {}) };
    setData(next);
    setEnabled(Boolean(next.enabled));
    setExtraUsers(Number(next.extraUsers) || 0);
    setExtraGarages(Number(next.extraGarages) || 0);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await adminApi.getPseudoData();
      applyResponse(payload);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to load pseudo data settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = await adminApi.updatePseudoData({
        enabled,
        extraUsers: Number(extraUsers) || 0,
        extraGarages: Number(extraGarages) || 0,
      });
      applyResponse(payload);
      setSuccess(
        enabled
          ? "Pseudo data enabled. Public pages now show the boosted counts."
          : "Pseudo data disabled. Public pages show real counts only.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to save pseudo data settings"));
    } finally {
      setSaving(false);
    }
  };

  const previewUsers =
    (Number(data.realUsers) || 0) + (enabled ? Number(extraUsers) || 0 : 0);
  const previewGarages =
    (Number(data.realGarages) || 0) + (enabled ? Number(extraGarages) || 0 : 0);

  const formatWhen = (value) => {
    if (!value) return "Never saved";
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Growth tools
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink sm:text-3xl">
              <FiBarChart2 className="text-brand" />
              Pseudo Data
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Temporarily boost the public customer and garage counts shown on
              marketing pages. No real accounts are created — only the numbers
              visitors see change. Turn this off when organic traction is enough.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <FiCheckCircle className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <FiUsers />
            Customers (real)
          </div>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {loading ? "—" : data.realUsers}
          </p>
          <p className="mt-1 text-xs text-muted">Active customer accounts in the database</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <FiHome />
            Garages (real)
          </div>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {loading ? "—" : data.realGarages}
          </p>
          <p className="mt-1 text-xs text-muted">Verified active garages in the database</p>
        </div>
      </div>

      <form
        onSubmit={save}
        className="space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Public display mode</h2>
            <p className="mt-1 text-sm text-muted">
              {enabled
                ? "Enabled — visitors see boosted counts on the homepage."
                : "Disabled — visitors see the original real counts only."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((value) => !value)}
            disabled={loading || saving}
            className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
              enabled
                ? "bg-brand text-black hover:brightness-95"
                : "border border-line bg-bg-soft text-ink hover:border-ink"
            }`}
            aria-pressed={enabled}
          >
            {enabled ? (
              <>
                <FiToggleRight className="text-xl" />
                Enabled
              </>
            ) : (
              <>
                <FiToggleLeft className="text-xl" />
                Disabled
              </>
            )}
          </button>
        </div>

        <div
          className={`grid gap-4 sm:grid-cols-2 ${enabled ? "" : "opacity-50"}`}
        >
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">
              Extra customers to display
            </span>
            <input
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={extraUsers}
              disabled={!enabled || loading || saving}
              onChange={(event) =>
                setExtraUsers(Math.max(0, Number(event.target.value) || 0))
              }
              className={controlClass}
            />
            <span className="text-xs text-muted">
              Added on top of {data.realUsers} real customers when enabled
            </span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">
              Extra garages to display
            </span>
            <input
              type="number"
              min={0}
              max={1000000}
              step={1}
              value={extraGarages}
              disabled={!enabled || loading || saving}
              onChange={(event) =>
                setExtraGarages(Math.max(0, Number(event.target.value) || 0))
              }
              className={controlClass}
            />
            <span className="text-xs text-muted">
              Added on top of {data.realGarages} real garages when enabled
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-dashed border-line bg-bg-soft px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Public preview
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted">Customers shown publicly</p>
              <p className="text-2xl font-extrabold text-ink">{previewUsers}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Garages shown publicly</p>
              <p className="text-2xl font-extrabold text-ink">{previewGarages}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">
            Last saved: {formatWhen(data.updatedAt)}
            {data.updatedByStaffName ? ` · by ${data.updatedByStaffName}` : ""}
          </p>
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            <FiSave />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Note</p>
        <p className="mt-1">
          This only affects public marketing stats (for example the homepage
          partner counters). Admin lists, dashboards, and real matching still use
          the true database counts.
        </p>
      </div>
    </div>
  );
}
