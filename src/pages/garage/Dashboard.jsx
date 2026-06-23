import { Link } from "react-router-dom";
import { FiInbox, FiBriefcase, FiCreditCard, FiTrendingUp, FiStar } from "react-icons/fi";

export default function GarageDashboard() {
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl bg-gradient-to-br from-ink to-ink-2 text-white p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <span className="chip-brand">AutoCare Premium · Verified</span>
        <h2 className="text-3xl font-bold mt-3">Welcome back, Rajesh 👋</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
          {[["₹48,200", "Earnings (Jun)"], ["12", "Active jobs"], ["4.9★", "Rating"], ["8", "New leads"]].map(([n, l]) => (
            <div key={l} className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-xl font-bold">{n}</div><div className="text-xs text-white/70">{l}</div></div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FiInbox, l: "New Leads", n: 8, link: "/garage/leads" },
          { icon: FiBriefcase, l: "Active Jobs", n: 12, link: "/garage/jobs" },
          { icon: FiCreditCard, l: "Wallet", n: "₹2,400", link: "/garage/wallet" },
          { icon: FiTrendingUp, l: "This Month", n: "₹48.2K", link: "/garage/earnings" },
        ].map((s) => (
          <Link to={s.link} key={s.l} className="card-soft p-5 hover:-translate-y-0.5 transition">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><s.icon /></div>
            <div className="text-2xl font-bold mt-3">{s.n}</div>
            <div className="text-sm">{s.l}</div>
          </Link>
        ))}
      </div>

      <div className="card-soft p-6">
        <h3 className="font-semibold mb-3">Recent Reviews</h3>
        <div className="grid gap-3">
          {[["Ayush K.", "Quick service, very polite mechanic.", 5], ["Priya S.", "Great experience, fair pricing.", 5], ["Rahul M.", "Slightly delayed but quality was good.", 4]].map(([n, t, r], i) => (
            <div key={i} className="flex items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-ink text-white text-xs font-bold">{n[0]}</span>
              <div className="flex-1"><div className="font-semibold text-sm flex items-center gap-2">{n} <span className="flex text-amber-500">{Array.from({length: r}).map((_, j) => <FiStar key={j} fill="currentColor" />)}</span></div><div className="text-sm text-muted">{t}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
