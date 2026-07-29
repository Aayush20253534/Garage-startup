import { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiHome,
  FiRefreshCw,
  FiSave,
  FiStar,
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
  pseudoAverageRating: null,
  realUsers: 0,
  realGarages: 0,
  realAverageRating: 0,
  displayUsers: 0,
  displayGarages: 0,
  displayAverageRating: 0,
  updatedAt: null,
  updatedByStaffName: null,
};

const formatRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toFixed(1);
};

export default function PseudoData() {
  const [data, setData] = useState(emptyState);
  const [enabled, setEnabled] = useState(false);
  const [extraUsers, setExtraUsers] = useState(0);
  const [extraGarages, setExtraGarages] = useState(0);
  const [pseudoAverageRating, setPseudoAverageRating] = useState("");
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
    setPseudoAverageRating(
      next.pseudoAverageRating === null || next.pseudoAverageRating === undefined
        ? ""
        : String(next.pseudoAverageRating),
    );
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

      const ratingRaw = String(pseudoAverageRating).trim();
      let ratingValue = null;
      if (ratingRaw !== "") {
        const n = Number(ratingRaw);
        if (!Number.isFinite(n) || n < 1 || n > 5) {
          setError("Pseudo average rating must be between 1.0 and 5.0, or left blank");
          setSaving(false);
          return;
        }
        ratingValue = Math.round(n * 10) / 10;
      }

      const payload = await adminApi.updatePseudoData({
        enabled,
        extraUsers: Number(extraUsers) || 0,
        extraGarages: Number(extraGarages) || 0,
        pseudoAverageRating: ratingValue,
      });
      applyResponse(payload);
      setSuccess(
        enabled
          ? "Pseudo data enabled. Public pages now show the boosted counts and rating."
          : "Pseudo data disabled. Public pages show real counts and rating only.",
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
  const ratingRaw = String(pseudoAverageRating).trim();
  const previewRating =
    enabled && ratingRaw !== "" && Number.isFinite(Number(ratingRaw))
      ? Number(ratingRaw)
      : data.realAverageRating;

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
              Temporarily boost the public customer count, garage count, and
              average rating on marketing pages. No real accounts or reviews are
              created — only the numbers visitors see change.
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <FiUsers />
            Customers (real)
          </div>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {loading ? "—" : data.realUsers}
          </p>
          <p className="mt-1 text-xs text-muted">Active customer accounts</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <FiHome />
            Garages (real)
          </div>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {loading ? "—" : data.realGarages}
          </p>
          <p className="mt-1 text-xs text-muted">Verified active garages</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <FiStar />
            Avg rating (real)
          </div>
          <p className="mt-2 text-3xl font-extrabold text-ink">
            {loading ? "—" : formatRating(data.realAverageRating)}
          </p>
          <p className="mt-1 text-xs text-muted">From verified garage ratings</p>
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
                ? "Enabled — visitors see boosted counts and optional rating."
                : "Disabled — visitors see the original real stats only."}
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
          className={`grid gap-4 sm:grid-cols-3 ${enabled ? "" : "opacity-50"}`}
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
              Added on top of {data.realUsers} real customers
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
              Added on top of {data.realGarages} real garages
            </span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">
              Pseudo average rating
            </span>
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              placeholder={formatRating(data.realAverageRating)}
              value={pseudoAverageRating}
              disabled={!enabled || loading || saving}
              onChange={(event) => setPseudoAverageRating(event.target.value)}
              className={controlClass}
            />
            <span className="text-xs text-muted">
              1.0–5.0, or blank to keep the real rating ({formatRating(data.realAverageRating)})
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-dashed border-line bg-bg-soft px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Public preview
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted">Customers shown publicly</p>
              <p className="text-2xl font-extrabold text-ink">{previewUsers}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Garages shown publicly</p>
              <p className="text-2xl font-extrabold text-ink">{previewGarages}</p>
            </div>
            <div>
              <p className="text-sm text-muted">Avg rating shown publicly</p>
              <p className="text-2xl font-extrabold text-ink">
                {formatRating(previewRating)}
              </p>
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
          the true database values.
        </p>
      </div>
    </div>
  );
}
