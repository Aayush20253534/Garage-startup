import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiKey,
  FiLogOut,
  FiPlus,
  FiRefreshCw,
  FiRepeat,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { adminApi } from "@/api/admin";
import { garageApi } from "@/api/garage";

const emptyForm = { name: "", email: "", phone: "+91", password: "" };
const emptyData = { garage: null, controllers: [] };
const message = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;
const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN") : "Never";

export default function ControllerManagement({ admin = false }) {
  const [garages, setGarages] = useState([]);
  const [garageId, setGarageId] = useState("");
  const [data, setData] = useState(emptyData);
  const [form, setForm] = useState(emptyForm);
  const [limitDrafts, setLimitDrafts] = useState({});
  const [transfer, setTransfer] = useState({ bookingId: "", controllerId: "" });
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedGarageId = admin ? garageId : null;
  const api = useMemo(
    () => ({
      list: () =>
        admin
          ? adminApi.getGarageControllers(selectedGarageId)
          : garageApi.getControllers(),
      create: (payload) =>
        admin
          ? adminApi.createGarageController(selectedGarageId, payload)
          : garageApi.createController(payload),
      update: (id, payload) =>
        admin
          ? adminApi.updateGarageController(id, selectedGarageId, payload)
          : garageApi.updateController(id, payload),
      password: (id, password) =>
        admin
          ? adminApi.resetGarageControllerPassword(id, selectedGarageId, password)
          : garageApi.resetControllerPassword(id, password),
      revoke: (id) =>
        admin
          ? adminApi.revokeGarageControllerSessions(id, selectedGarageId)
          : garageApi.revokeControllerSessions(id),
      remove: (id) =>
        admin
          ? adminApi.deleteGarageController(id, selectedGarageId)
          : garageApi.deleteController(id),
      transfer: (bookingId, controllerId) =>
        admin
          ? adminApi.transferGarageControllerBooking(
              bookingId,
              selectedGarageId,
              controllerId,
            )
          : garageApi.transferControllerBooking(bookingId, controllerId),
      activity: (id) =>
        admin
          ? adminApi.getGarageControllerActivity(id, selectedGarageId)
          : garageApi.getControllerActivity(id),
    }),
    [admin, selectedGarageId],
  );

  const load = async () => {
    if (admin && !selectedGarageId) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.list();
      setData(result || emptyData);
    } catch (err) {
      setError(message(err, "Unable to load controllers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!admin) void load();
  }, [admin]);

  useEffect(() => {
    if (admin && selectedGarageId) void load();
  }, [admin, selectedGarageId]);

  useEffect(() => {
    if (!admin) return;

    adminApi
      .getGarages({ limit: 100 })
      .then((result) => {
        const list = Array.isArray(result)
          ? result
          : result?.items || result?.garages || result?.data || [];
        setGarages(list);
        setLimitDrafts(
          Object.fromEntries(
            list.map((garage) => [
              garage.id,
              Number(garage.controllerLimit ?? 3),
            ]),
          ),
        );
        if (list[0]?.id) setGarageId((current) => current || list[0].id);
      })
      .catch((err) => setError(message(err, "Unable to load garages")));
  }, [admin]);

  const perform = async (action, success) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (err) {
      setError(message(err, "Controller action failed"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const create = (event) => {
    event.preventDefault();
    void (async () => {
      const created = await perform(
        () => api.create(form),
        `Controller created for ${data.garage?.name || "this garage"}.`,
      );
      if (created) setForm(emptyForm);
    })();
  };

  const saveGarageLimit = async (garage) => {
    const value = Number(limitDrafts[garage.id]);
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const updated = await adminApi.setGarageControllerLimit(garage.id, value);
      setGarages((current) =>
        current.map((item) =>
          item.id === garage.id
            ? { ...item, controllerLimit: updated.controllerLimit }
            : item,
        ),
      );
      setLimitDrafts((current) => ({
        ...current,
        [garage.id]: updated.controllerLimit,
      }));
      if (selectedGarageId === garage.id) {
        setData((current) => ({
          ...current,
          garage: {
            ...(current.garage || {}),
            controllerLimit: updated.controllerLimit,
          },
        }));
      }
      setNotice(`Controller limit updated for ${garage.name} only.`);
    } catch (err) {
      setError(
        message(err, "Unable to update this garage's controller limit"),
      );
    } finally {
      setLoading(false);
    }
  };

  const openActivity = async (controllerId) => {
    setError("");
    try {
      setActivity(await api.activity(controllerId));
    } catch (err) {
      setError(message(err, "Unable to load activity"));
    }
  };

  const resetPassword = (controller) => {
    const password = window.prompt(`New strong password for ${controller.name}`);
    if (password) {
      void perform(
        () => api.password(controller.id, password),
        "Password reset and sessions revoked.",
      );
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-bg-soft text-xl text-ink">
            <FiUsers />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Garage operations
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">
              Sub-controllers
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
              Available controllers receive booking alerts. The first acceptance
              wins atomically, and active customer details stay private to the
              assigned controller.
            </p>
          </div>
        </div>

        {admin && (
          <label className="mt-5 block max-w-2xl">
            <span className="mb-2 block text-sm font-bold text-ink">
              Manage a garage
            </span>
            <select
              value={garageId}
              onChange={(event) => {
                setGarageId(event.target.value);
                setData(emptyData);
                setActivity(null);
              }}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-ink"
            >
              <option value="">Select garage</option>
              {garages.map((garage) => (
                <option key={garage.id} value={garage.id}>
                  {garage.name} — {garage.city || "City unavailable"}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <FiCheckCircle className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {admin && garages.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div>
            <h2 className="font-bold text-ink">Garage-wise controller limits</h2>
            <p className="mt-1 text-xs text-muted">
              Each limit applies only to the garage shown on that card.
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {garages.map((garage) => {
              const selected = garage.id === selectedGarageId;
              return (
                <div
                  key={garage.id}
                  className={`border p-4 ${
                    selected
                      ? "border-ink bg-bg-soft"
                      : "border-line bg-white"
                  } rounded-md`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {garage.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {garage.city || "City unavailable"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Controller limit for ${garage.name}`}
                        type="number"
                        min="0"
                        max="100"
                        value={limitDrafts[garage.id] ?? 3}
                        onChange={(event) =>
                          setLimitDrafts((current) => ({
                            ...current,
                            [garage.id]: event.target.value,
                          }))
                        }
                        className="h-10 w-24 rounded-md border border-line px-3 text-sm outline-none focus:border-ink"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void saveGarageLimit(garage)}
                        className="h-10 rounded-md bg-ink px-4 text-xs font-bold text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Save limit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(!admin || selectedGarageId) && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <FiPlus />
            <h2 className="font-bold text-ink">Create controller</h2>
          </div>
          {admin && (
            <p className="mt-1 text-xs font-semibold text-muted">
              This account will belong only to{" "}
              <span className="text-ink">
                {data.garage?.name || "the selected garage"}
              </span>
              .
            </p>
          )}
          <form onSubmit={create} className="mt-4 grid gap-3 lg:grid-cols-5">
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-ink"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-ink"
            />
            <input
              required
              placeholder="+919876543210"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-ink"
            />
            <input
              required
              type="password"
              placeholder="Strong password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              className="h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-ink"
            />
            <button
              disabled={loading}
              className="h-11 rounded-md bg-ink px-4 text-sm font-bold text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create controller
            </button>
          </form>
          <p className="mt-3 text-xs text-muted">
            {data.controllers?.length || 0} of{" "}
            {data.garage?.controllerLimit ?? "—"} configured.
          </p>
        </section>
      )}

      {(!admin || selectedGarageId) && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <FiRepeat />
            <h2 className="font-bold text-ink">Transfer active booking</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Moving a booking releases the previous controller and marks the
            selected available controller as busy.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(
                () => api.transfer(transfer.bookingId, transfer.controllerId),
                "Booking transferred.",
              );
            }}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input
              required
              value={transfer.bookingId}
              onChange={(event) =>
                setTransfer({ ...transfer, bookingId: event.target.value })
              }
              placeholder="Booking UUID"
              className="h-11 rounded-md border border-line px-3 text-sm outline-none focus:border-ink"
            />
            <select
              required
              value={transfer.controllerId}
              onChange={(event) =>
                setTransfer({ ...transfer, controllerId: event.target.value })
              }
              className="h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-ink"
            >
              <option value="">Available target controller</option>
              {(data.controllers || [])
                .filter(
                  (item) =>
                    item.isActive && item.availability === "AVAILABLE",
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <button
              disabled={loading}
              className="h-11 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Transfer
            </button>
          </form>
        </section>
      )}

      {(!admin || selectedGarageId) && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">Controller accounts</h2>
              <p className="mt-1 text-xs text-muted">
                Manage availability, access, sessions, and assignment history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data.controllers || []).map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-ink">
                      {item.name}
                    </h3>
                    <p className="mt-1 break-all text-xs text-muted">
                      {item.email}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.phone}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold ${
                      item.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.isActive ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
                      Availability
                    </span>
                    <select
                      value={item.availability}
                      disabled={loading || !item.isActive}
                      onChange={(event) =>
                        void perform(
                          () =>
                            api.update(item.id, {
                              availability: event.target.value,
                            }),
                          "Availability updated.",
                        )
                      }
                      className="h-10 w-full rounded-md border border-line bg-white px-2 text-xs font-bold outline-none focus:border-ink disabled:bg-bg-soft"
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="BUSY">BUSY</option>
                    </select>
                  </label>
                  <div>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
                      Account access
                    </span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void perform(
                          () =>
                            api.update(item.id, { isActive: !item.isActive }),
                          item.isActive
                            ? "Controller disabled and sessions revoked."
                            : "Controller enabled.",
                        )
                      }
                      className="h-10 w-full rounded-md border border-line bg-white px-2 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
                    >
                      {item.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border border-line bg-bg-soft p-2">
                    <p className="text-base font-extrabold text-ink">
                      {item._count?.bookings || 0}
                    </p>
                    <p className="text-[10px] uppercase text-muted">Bookings</p>
                  </div>
                  <div className="rounded-md border border-line bg-bg-soft p-2">
                    <p className="text-base font-extrabold text-ink">
                      {item._count?.dispatches || 0}
                    </p>
                    <p className="text-[10px] uppercase text-muted">Messages</p>
                  </div>
                  <div className="rounded-md border border-line bg-bg-soft p-2">
                    <p className="truncate text-xs font-extrabold text-ink">
                      {item.availability}
                    </p>
                    <p className="text-[10px] uppercase text-muted">Status</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted">
                  Last active: {formatDate(item.lastActiveAt)}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void openActivity(item.id)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
                  >
                    <FiActivity /> Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => resetPassword(item)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
                  >
                    <FiKey /> Password
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void perform(
                        () => api.revoke(item.id),
                        "All sessions revoked.",
                      )
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
                  >
                    <FiLogOut /> Force logout
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete ${item.name}?`)) {
                        void perform(
                          () => api.remove(item.id),
                          "Controller deleted.",
                        );
                      }
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                  >
                    <FiTrash2 /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!loading && !(data.controllers || []).length && (
            <div className="mt-4 rounded-md border border-dashed border-line bg-bg-soft px-4 py-10 text-center text-sm text-muted">
              No controllers configured for this garage.
            </div>
          )}
        </section>
      )}

      {activity && (
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">
                {activity.controller?.name} activity
              </h2>
              <p className="mt-1 text-xs text-muted">
                Latest 100 booking assignments and message deliveries.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivity(null)}
              className="h-9 rounded-md border border-line px-3 text-xs font-bold text-ink transition hover:border-ink hover:bg-bg-soft"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-ink">Assigned bookings</h3>
              <div className="mt-2 space-y-2">
                {(activity.bookings || []).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-line bg-bg-soft p-3 text-xs"
                  >
                    <p className="font-bold text-ink">
                      {item.bookingCode} · {item.vehicle?.brand}{" "}
                      {item.vehicle?.model}
                    </p>
                    <p className="mt-1 break-all text-muted">
                      {item.status} · {item.id}
                    </p>
                    {!['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(item.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransfer({ bookingId: item.id, controllerId: "" });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="mt-3 h-9 rounded-md border border-line bg-white px-3 font-bold text-ink transition hover:border-ink"
                      >
                        Select for transfer
                      </button>
                    )}
                  </div>
                ))}
                {!(activity.bookings || []).length && (
                  <p className="rounded-md border border-dashed border-line p-5 text-center text-xs text-muted">
                    No assigned bookings found.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-ink">Message dispatches</h3>
              <div className="mt-2 space-y-2">
                {(activity.dispatches || []).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-line bg-bg-soft p-3 text-xs"
                  >
                    <p className="font-bold text-ink">
                      {item.channel} · {item.status}
                    </p>
                    <p className="mt-1 text-muted">
                      {formatDate(item.sentAt)} · booking {item.request?.bookingId}
                    </p>
                    {item.failureReason && (
                      <p className="mt-1 text-red-700">{item.failureReason}</p>
                    )}
                  </div>
                ))}
                {!(activity.dispatches || []).length && (
                  <p className="rounded-md border border-dashed border-line p-5 text-center text-xs text-muted">
                    No message dispatches found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
