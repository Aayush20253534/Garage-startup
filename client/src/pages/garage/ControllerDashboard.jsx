import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBell, FiCheckCircle, FiClock, FiRefreshCw, FiUserCheck } from "react-icons/fi";
import { garageApi } from "@/api/garage";

const bookingTitle = (booking) => `${booking.vehicle?.brand || "Vehicle"} ${booking.vehicle?.model || ""}`.trim();

export default function ControllerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setData(await garageApi.getControllerDashboard()); }
    catch (err) { setError(err.response?.data?.message || err.message || "Unable to load controller dashboard"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const setAvailability = async (availability) => {
    try { await garageApi.setControllerAvailability(availability); await load(); }
    catch (err) { setError(err.response?.data?.message || err.message || "Unable to update availability"); }
  };
  const controller = data?.controller;
  return <div className="space-y-5">
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-muted">Controller workspace</p><h1 className="mt-1 text-2xl font-extrabold text-ink">Welcome, {controller?.name || "controller"}</h1><p className="mt-2 text-sm text-muted">Only your active assignments expose customer contact and location details.</p></div><div className="flex gap-2"><button onClick={() => void setAvailability("AVAILABLE")} className={`rounded-xl px-4 py-2 text-sm font-bold ${controller?.availability === "AVAILABLE" ? "bg-emerald-600 text-white" : "border border-line"}`}>Available</button><button onClick={() => void setAvailability("BUSY")} className={`rounded-xl px-4 py-2 text-sm font-bold ${controller?.availability === "BUSY" ? "bg-amber-500 text-black" : "border border-line"}`}>Busy</button><button onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-xl border border-line"><FiRefreshCw className={loading ? "animate-spin" : ""}/></button></div></div></section>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <section className="grid gap-4 md:grid-cols-3">{[[FiClock,"Active assignments",data?.active?.length||0],[FiUserCheck,"Your completed history",data?.ownHistory?.length||0],[FiBell,"Notifications",data?.notifications?.length||0]].map(([Icon,label,value])=><div key={label} className="rounded-2xl border border-line bg-white p-5 shadow-soft"><Icon className="text-xl"/><p className="mt-4 text-3xl font-extrabold">{value}</p><p className="text-sm text-muted">{label}</p></div>)}</section>
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><h2 className="font-bold text-ink">Your active bookings</h2><Link to="/garage/bookings" className="text-sm font-bold underline">Open bookings</Link></div><div className="mt-4 grid gap-3">{(data?.active||[]).map((booking)=><Link key={booking.id} to={`/garage/bookings/${booking.id}`} className="rounded-xl border border-line p-4 hover:bg-bg-soft"><p className="font-bold">{bookingTitle(booking)}</p><p className="mt-1 text-xs text-muted">{booking.bookingCode} · {booking.status} · {booking.user?.name}</p></Link>)}{!loading && !(data?.active||[]).length && <p className="py-6 text-center text-sm text-muted">No active assignment. Stay available for new alerts.</p>}</div></section>
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft"><h2 className="font-bold text-ink">Combined garage history</h2><p className="mt-1 text-xs text-muted">Completed and cancelled work from every controller. Other controllers’ customer phone and address remain hidden.</p><div className="mt-4 divide-y divide-line">{(data?.combinedHistory||[]).map((booking)=><div key={booking.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-semibold">{bookingTitle(booking)}</p><p className="text-xs text-muted">{booking.bookingCode} · handled by {booking.garageController?.name || "central account"}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-bg-soft px-3 py-1 text-xs font-bold"><FiCheckCircle/>{booking.status}</span></div>)}</div></section>
  </div>;
}
