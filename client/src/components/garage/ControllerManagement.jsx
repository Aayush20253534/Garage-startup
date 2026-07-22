import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiKey, FiPlus, FiRefreshCw, FiTrash2, FiUsers } from "react-icons/fi";
import { adminApi } from "@/api/admin";
import { garageApi } from "@/api/garage";

const emptyForm = { name: "", email: "", phone: "+91", password: "" };
const message = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

export default function ControllerManagement({ admin = false }) {
  const [garages, setGarages] = useState([]);
  const [garageId, setGarageId] = useState("");
  const [data, setData] = useState({ garage: null, controllers: [] });
  const [form, setForm] = useState(emptyForm);
  const [limitDrafts, setLimitDrafts] = useState({});
  const [transfer, setTransfer] = useState({ bookingId: "", controllerId: "" });
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedGarageId = admin ? garageId : null;
  const api = useMemo(() => ({
    list: () => admin ? adminApi.getGarageControllers(selectedGarageId) : garageApi.getControllers(),
    create: (payload) => admin ? adminApi.createGarageController(selectedGarageId, payload) : garageApi.createController(payload),
    update: (id, payload) => admin ? adminApi.updateGarageController(id, selectedGarageId, payload) : garageApi.updateController(id, payload),
    password: (id, password) => admin ? adminApi.resetGarageControllerPassword(id, selectedGarageId, password) : garageApi.resetControllerPassword(id, password),
    revoke: (id) => admin ? adminApi.revokeGarageControllerSessions(id, selectedGarageId) : garageApi.revokeControllerSessions(id),
    remove: (id) => admin ? adminApi.deleteGarageController(id, selectedGarageId) : garageApi.deleteController(id),
    transfer: (bookingId, controllerId) => admin ? adminApi.transferGarageControllerBooking(bookingId, selectedGarageId, controllerId) : garageApi.transferControllerBooking(bookingId, controllerId),
    activity: (id) => admin ? adminApi.getGarageControllerActivity(id, selectedGarageId) : garageApi.getControllerActivity(id),
  }), [admin, selectedGarageId]);

  const load = async () => {
    if (admin && !selectedGarageId) return;
    setLoading(true); setError("");
    try {
      const result = await api.list();
      setData(result || { garage: null, controllers: [] });
    } catch (err) { setError(message(err, "Unable to load controllers")); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!admin) void load(); }, [admin]);
  useEffect(() => { if (admin && selectedGarageId) void load(); }, [admin, selectedGarageId]);
  useEffect(() => {
    if (!admin) return;
    adminApi.getGarages({ limit: 100 }).then((result) => {
      const list = Array.isArray(result) ? result : result?.items || result?.garages || result?.data || [];
      setGarages(list);
      setLimitDrafts(Object.fromEntries(list.map((garage) => [garage.id, Number(garage.controllerLimit ?? 3)])));
      if (list[0]?.id) setGarageId((current) => current || list[0].id);
    }).catch((err) => setError(message(err, "Unable to load garages")));
  }, [admin]);

  const perform = async (action, success) => {
    setLoading(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await load(); return true; }
    catch (err) { setError(message(err, "Controller action failed")); return false; }
    finally { setLoading(false); }
  };

  const create = (event) => {
    event.preventDefault();
    void (async () => {
      const created = await perform(() => api.create(form), `Controller created for ${data.garage?.name || "this garage"}.`);
      if (created) setForm(emptyForm);
    })();
  };

  const saveGarageLimit = async (garage) => {
    const value = Number(limitDrafts[garage.id]);
    setLoading(true); setError(""); setNotice("");
    try {
      const updated = await adminApi.setGarageControllerLimit(garage.id, value);
      setGarages((current) => current.map((item) => item.id === garage.id ? { ...item, controllerLimit: updated.controllerLimit } : item));
      setLimitDrafts((current) => ({ ...current, [garage.id]: updated.controllerLimit }));
      if (selectedGarageId === garage.id) {
        setData((current) => ({ ...current, garage: { ...current.garage, controllerLimit: updated.controllerLimit } }));
      }
      setNotice(`Controller limit updated for ${garage.name} only.`);
    } catch (err) { setError(message(err, "Unable to update this garage's controller limit")); }
    finally { setLoading(false); }
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Garage operations</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink"><FiUsers /> Sub-controllers</h1>
      <p className="mt-2 text-sm text-muted">Controllers receive booking alerts only while available. The first acceptance wins atomically; active bookings remain private to their assigned controller.</p>
      {admin && <select value={garageId} onChange={(event) => { setGarageId(event.target.value); setData({ garage: null, controllers: [] }); setActivity(null); }} className="mt-4 h-11 w-full max-w-xl rounded-lg border border-line px-3 text-sm">
        <option value="">Select garage</option>{garages.map((garage) => <option key={garage.id} value={garage.id}>{garage.name} — {garage.city}</option>)}
      </select>}
    </section>
    {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><FiAlertCircle />{error}</div>}
    {notice && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><FiCheckCircle />{notice}</div>}
    {admin && garages.length > 0 && <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <h2 className="font-bold text-ink">Garage-wise controller limits</h2>
      <p className="mt-1 text-xs text-muted">Each value applies only to the garage shown on that row.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {garages.map((garage) => <div key={garage.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${garage.id === selectedGarageId ? "border-brand bg-brand/5" : "border-line"}`}><div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{garage.name}</p><p className="text-xs text-muted">{garage.city || "City unavailable"}</p></div><div className="flex items-center gap-2"><input aria-label={`Controller limit for ${garage.name}`} type="number" min="0" max="100" value={limitDrafts[garage.id] ?? 3} onChange={(event) => setLimitDrafts((current) => ({ ...current, [garage.id]: event.target.value }))} className="h-10 w-20 rounded-lg border border-line px-3"/><button disabled={loading} onClick={() => void saveGarageLimit(garage)} className="h-10 rounded-lg bg-ink px-3 text-xs font-bold text-white">Save</button></div></div>)}
      </div>
    </section>}
    {(!admin || selectedGarageId) && <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-bold text-ink"><FiPlus /> Create controller</h2>
      {admin && <p className="mt-1 text-xs font-semibold text-muted">New account will belong only to: <span className="text-ink">{data.garage?.name || "Loading selected garage…"}</span></p>}
      <form onSubmit={create} className="mt-4 grid gap-3 lg:grid-cols-5"><input required placeholder="Name" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} className="h-11 rounded-lg border border-line px-3 text-sm"/><input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({...form,email:e.target.value})} className="h-11 rounded-lg border border-line px-3 text-sm"/><input required placeholder="+919876543210" value={form.phone} onChange={(e) => setForm({...form,phone:e.target.value})} className="h-11 rounded-lg border border-line px-3 text-sm"/><input required type="password" placeholder="Strong password" value={form.password} onChange={(e) => setForm({...form,password:e.target.value})} className="h-11 rounded-lg border border-line px-3 text-sm"/><button disabled={loading} className="rounded-lg bg-ink px-4 text-sm font-bold text-white">Create</button></form>
      <p className="mt-2 text-xs text-muted">{data.controllers?.length || 0} of {data.garage?.controllerLimit ?? "—"} configured.</p>
    </section>}
    {(!admin || selectedGarageId) && <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><h2 className="font-bold text-ink">Transfer active booking</h2><p className="mt-1 text-xs text-muted">Only the garage owner or admin can move an active booking. The previous controller becomes available and the target becomes busy.</p><form onSubmit={(event) => { event.preventDefault(); void perform(() => api.transfer(transfer.bookingId, transfer.controllerId), "Booking transferred."); }} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input required value={transfer.bookingId} onChange={(e)=>setTransfer({...transfer,bookingId:e.target.value})} placeholder="Booking UUID" className="h-11 rounded-lg border border-line px-3 text-sm"/><select required value={transfer.controllerId} onChange={(e)=>setTransfer({...transfer,controllerId:e.target.value})} className="h-11 rounded-lg border border-line px-3 text-sm"><option value="">Available target controller</option>{(data.controllers||[]).filter((item)=>item.isActive&&item.availability==='AVAILABLE').map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button disabled={loading} className="rounded-lg bg-ink px-4 text-sm font-bold text-white">Transfer</button></form></section>}
    <section className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft"><table className="min-w-full text-left text-sm"><thead className="bg-bg-soft text-xs uppercase text-muted"><tr><th className="p-4">Controller</th><th className="p-4">Availability</th><th className="p-4">Activity</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-line">
      {(data.controllers || []).map((item) => <tr key={item.id}><td className="p-4"><p className="font-bold">{item.name}</p><p className="text-xs text-muted">{item.phone} · {item.email}</p></td><td className="p-4"><select value={item.availability} onChange={(e) => void perform(() => api.update(item.id,{availability:e.target.value}), "Availability updated.")} className="rounded-lg border border-line px-2 py-2"><option>AVAILABLE</option><option>BUSY</option></select><button onClick={() => void perform(() => api.update(item.id,{isActive:!item.isActive}), "Account status updated.")} className={`ml-2 rounded-full px-2 py-1 text-xs font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100"}`}>{item.isActive ? "Active" : "Disabled"}</button></td><td className="p-4 text-xs text-muted"><p>Last active: {item.lastActiveAt ? new Date(item.lastActiveAt).toLocaleString("en-IN") : "Never"}</p><p>Bookings: {item._count?.bookings || 0} · Messages: {item._count?.dispatches || 0}</p></td><td className="p-4"><div className="flex flex-wrap gap-2"><button onClick={async () => { try { setActivity(await api.activity(item.id)); } catch(err) { setError(message(err,"Unable to load activity")); } }} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">View activity</button><button onClick={() => { const password=window.prompt("New strong password"); if(password) void perform(() => api.password(item.id,password),"Password reset and sessions revoked."); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs font-bold"><FiKey/>Password</button><button onClick={() => void perform(() => api.revoke(item.id),"All sessions revoked.")} className="rounded-lg border border-line px-3 py-2 text-xs font-bold">Force logout</button><button onClick={() => { if(window.confirm(`Delete ${item.name}?`)) void perform(() => api.remove(item.id),"Controller deleted."); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><FiTrash2/>Delete</button></div></td></tr>)}
      {!loading && !(data.controllers || []).length && <tr><td colSpan="4" className="p-10 text-center text-muted">No controllers configured.</td></tr>}
    </tbody></table><button onClick={() => void load()} className="m-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-bold"><FiRefreshCw className={loading ? "animate-spin" : ""}/>Refresh</button></section>
    {activity && <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex justify-between gap-3"><div><h2 className="font-bold text-ink">{activity.controller?.name} activity</h2><p className="text-xs text-muted">Latest 100 assignments and message deliveries</p></div><button onClick={()=>setActivity(null)} className="rounded-lg border border-line px-3 text-xs font-bold">Close</button></div><div className="mt-4 grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-bold">Assigned bookings</h3><div className="mt-2 divide-y divide-line">{(activity.bookings||[]).map((item)=><div key={item.id} className="py-2 text-xs"><p className="font-bold">{item.bookingCode} · {item.vehicle?.brand} {item.vehicle?.model}</p><p className="break-all text-muted">{item.status} · {item.id}</p>{!['COMPLETED','CANCELLED','EXPIRED'].includes(item.status) && <button onClick={()=>{setTransfer({bookingId:item.id,controllerId:''}); window.scrollTo({top:0,behavior:'smooth'});}} className="mt-2 rounded-lg border border-line px-2 py-1 font-bold">Select for transfer</button>}</div>)}</div></div><div><h3 className="text-sm font-bold">Message dispatches</h3><div className="mt-2 divide-y divide-line">{(activity.dispatches||[]).map((item)=><div key={item.id} className="py-2 text-xs"><p className="font-bold">{item.channel} · {item.status}</p><p className="text-muted">{new Date(item.sentAt).toLocaleString('en-IN')} · booking {item.request?.bookingId}</p></div>)}</div></div></div></section>}
  </div>;
}
