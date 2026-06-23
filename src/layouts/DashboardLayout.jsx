import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Logo from "@/components/common/Logo";
import { useApp } from "@/hooks/useApp";
import { FiMenu, FiX, FiLogOut } from "react-icons/fi";

export default function DashboardLayout({ items, title }) {
  const { pathname } = useLocation();
  const { user, logout } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-bg-soft flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-line flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 flex`}>
        <div className="p-5 border-b border-line flex items-center justify-between">
          <Logo />
          <button className="lg:hidden" onClick={() => setOpen(false)}><FiX /></button>
        </div>
        <nav className="flex-1 p-3 grid gap-1 overflow-y-auto">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${isActive ? "bg-ink text-white" : "text-ink/70 hover:bg-bg-soft hover:text-ink"}`}>
              <it.icon className="text-base" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-brand text-ink font-bold">{user?.name?.[0] || "R"}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name || "Guest"}</div>
              <div className="text-xs text-muted truncate">{user?.role || "customer"}</div>
            </div>
          </div>
          <button onClick={() => { logout(); nav("/"); }} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm border border-line hover:border-ink"><FiLogOut /> Logout</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-line">
          <div className="px-5 lg:px-10 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setOpen(true)} className="lg:hidden grid place-items-center h-10 w-10 rounded-full border border-line"><FiMenu /></button>
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </div>
        </header>
        <motion.main initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-5 lg:p-10">
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
