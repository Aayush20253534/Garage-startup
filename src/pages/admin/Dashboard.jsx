import { FiUsers, FiHome, FiCalendar, FiDollarSign, FiTrendingUp } from "react-icons/fi";
export default function AdminDashboard() {
  const monthly = [42, 56, 49, 68, 73, 81, 77, 85, 92, 98, 105, 118];
  const max = Math.max(...monthly);
  const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  return (
    <div className="grid gap-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { icon: FiUsers, n: "52,841", l: "Total Customers", c: "+12%" },
          { icon: FiHome, n: "8,420", l: "Verified Garages", c: "+8%" },
          { icon: FiCalendar, n: "1,284", l: "Active Bookings", c: "+24%" },
          { icon: FiTrendingUp, n: "98,210", l: "Completed Services", c: "+18%" },
          { icon: FiDollarSign, n: "₹2.4Cr", l: "Revenue (June)", c: "+32%" },
        ].map((s) => (
          <div key={s.l} className="card-soft p-5">
            <div className="flex items-center justify-between"><div className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><s.icon /></div><span className="chip-brand">{s.c}</span></div>
            <div className="text-2xl font-bold mt-3">{s.n}</div>
            <div className="text-sm text-muted">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-6 lg:col-span-2">
          <h3 className="font-semibold mb-4">Monthly bookings</h3>
          <div className="flex items-end gap-2 h-56">
            {monthly.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-xl bg-ink" style={{ height: `${(v/max)*100}%` }} />
                <div className="text-[10px] text-muted">{months[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-6">
          <h3 className="font-semibold mb-3">Activity Feed</h3>
          <ul className="grid gap-3 text-sm">
            {[
              ["New garage onboarded", "Speed Motors · Pune", "2m"],
              ["Booking completed", "RV2384 · ₹3,549", "8m"],
              ["Refund issued", "RV2210 · ₹499", "1h"],
              ["Garage verified", "Prime Auto Hub", "3h"],
            ].map(([t, s, x], i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="h-2 w-2 rounded-full bg-brand mt-2" />
                <div className="flex-1"><div className="font-medium">{t}</div><div className="text-xs text-muted">{s}</div></div>
                <span className="text-xs text-muted">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-soft p-6">
        <h3 className="font-semibold mb-4">Top Garages</h3>
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left"><tr>{["Garage", "City", "Bookings", "Rating", "Revenue"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {[["AutoCare Premium", "Ghaziabad", 284, "4.9", "₹9.8L"],["Speed Motors", "Pune", 219, "4.8", "₹7.4L"],["Prime Auto Hub", "Noida", 198, "4.7", "₹6.9L"]].map((r) => (
              <tr key={r[0]} className="border-t border-line">{r.map((c, i) => <td key={i} className="px-4 py-3">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
