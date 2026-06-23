import { FiPlus, FiMinus } from "react-icons/fi";

const TX = [
  { type: "credit", t: "Wallet recharge", amount: 1000, time: "Today" },
  { type: "debit", t: "Lead unlock · RV2391", amount: 40, time: "Today" },
  { type: "debit", t: "Lead unlock · RV2390", amount: 40, time: "Yesterday" },
  { type: "credit", t: "Wallet recharge", amount: 500, time: "12 Jun" },
];

export default function Wallet() {
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl bg-gradient-to-br from-ink to-ink-2 text-white p-8">
        <span className="chip-brand">Wallet</span>
        <div className="mt-3 text-sm text-white/60">Available balance</div>
        <div className="text-5xl font-bold mt-1">₹2,400</div>
        <div className="mt-6 flex flex-wrap gap-2">
          {[500, 1000, 2000, 5000].map((a) => (
            <button key={a} className="px-5 py-3 rounded-full bg-brand text-ink font-semibold hover:bg-brand-dark transition">+ ₹{a}</button>
          ))}
        </div>
      </div>
      <div className="card-soft p-6">
        <h3 className="font-semibold mb-3">Recent Transactions</h3>
        <div className="grid gap-2">
          {TX.map((t, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
              <span className={`grid place-items-center h-9 w-9 rounded-full ${t.type === "credit" ? "bg-brand text-ink" : "bg-bg-soft text-ink"}`}>{t.type === "credit" ? <FiPlus /> : <FiMinus />}</span>
              <div className="flex-1"><div className="font-medium text-sm">{t.t}</div><div className="text-xs text-muted">{t.time}</div></div>
              <div className={`font-semibold ${t.type === "credit" ? "text-green-600" : "text-red-500"}`}>{t.type === "credit" ? "+" : "-"}₹{t.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
