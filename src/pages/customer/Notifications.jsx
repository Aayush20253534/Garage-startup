import { FiBell } from "react-icons/fi";
const N = [
  { t: "Mechanic arriving in 15 minutes", time: "2 min ago", new: true },
  { t: "Your booking #RV2384 is confirmed", time: "1 hour ago", new: true },
  { t: "Warranty W-2384 activated", time: "Yesterday" },
  { t: "Special: 15% off on AC services this week", time: "2 days ago" },
];
export default function Notifications() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Notifications</h2>
      <div className="grid gap-3">
        {N.map((n, i) => (
          <div key={i} className={`card-soft p-4 flex items-center gap-4 ${n.new ? "border-l-4 border-l-brand" : ""}`}>
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><FiBell /></span>
            <div className="flex-1"><div className="font-medium">{n.t}</div><div className="text-xs text-muted">{n.time}</div></div>
            {n.new && <span className="chip-brand">New</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
