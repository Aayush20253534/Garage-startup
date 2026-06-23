import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX, FiChevronDown, FiShoppingBag, FiUser, FiTruck, FiPlus, FiLogOut } from "react-icons/fi";
import Logo from "@/components/common/Logo";
import { useApp } from "@/hooks/useApp";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [vehOpen, setVehOpen] = useState(false);
  const { user, vehicle, cart, logout } = useApp();
  const nav = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-xl border-b border-line" : "bg-transparent"}`}
    >
      <div className="container-x flex items-center justify-between h-16 sm:h-20">
        <Link to="/" className="shrink-0"><Logo /></Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              className={({ isActive }) => `relative px-4 py-2 rounded-full text-sm font-medium transition ${isActive ? "text-ink" : "text-ink/70 hover:text-ink"}`}>
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-[#f4f4f4]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {!user ? (
            <>
              <Link to="/login" className="btn-ghost text-sm">Login</Link>
              <Link to="/register" className="btn-ghost text-sm">Register</Link>
              <Link to="/booking/vehicle" className="btn-primary text-sm">Book Service</Link>
            </>
          ) : (
            <>
              {vehicle ? (
                <div className="relative">
                  <button onClick={() => setVehOpen((v) => !v)} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-line bg-white hover:border-ink transition">
                    <span className="grid place-items-center h-7 w-7 rounded-full bg-brand text-ink"><FiTruck className="text-sm" /></span>
                    <span className="text-xs leading-tight text-left">
                      <span className="block font-semibold">{vehicle.brand} {vehicle.model}</span>
                      <span className="block text-muted">{vehicle.fuel}</span>
                    </span>
                    <FiChevronDown className="text-muted" />
                  </button>
                  <AnimatePresence>
                    {vehOpen && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="absolute right-0 mt-2 w-56 card-soft p-2">
                        <Link to="/booking/vehicle" className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bg-soft text-sm"><FiPlus /> Change Vehicle</Link>
                        <Link to="/booking/vehicle" className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bg-soft text-sm"><FiPlus /> Add New Vehicle</Link>
                        <Link to="/dashboard/vehicles" className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bg-soft text-sm"><FiTruck /> My Vehicles</Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to="/booking/vehicle" className="btn-primary text-sm"><FiPlus /> Add Your Vehicle</Link>
              )}

              <Link to="/checkout" className="relative grid place-items-center h-10 w-10 rounded-full border border-line bg-white hover:border-ink transition">
                <FiShoppingBag />
                {cart.length > 0 && <span className="absolute -top-1 -right-1 text-[10px] bg-brand text-ink rounded-full px-1.5 font-bold">{cart.length}</span>}
              </Link>

              <div className="relative">
                <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-line bg-white hover:border-ink transition">
                  <span className="grid place-items-center h-8 w-8 rounded-full bg-ink text-white text-xs font-bold">{user.name[0]}</span>
                  <span className="text-sm font-medium">{user.name}</span>
                  <FiChevronDown className="text-muted" />
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="absolute right-0 mt-2 w-56 card-soft p-2">
                      {[
                        ["Dashboard", "/dashboard"],
                        ["Active Bookings", "/dashboard/bookings"],
                        ["Service History", "/dashboard/history"],
                        ["Warranty Center", "/warranty"],
                        ["Profile Settings", "/dashboard/profile"],
                      ].map(([l, t]) => (
                        <Link key={t} to={t} onClick={() => setProfileOpen(false)} className="block px-3 py-2 rounded-xl hover:bg-bg-soft text-sm">{l}</Link>
                      ))}
                      <button onClick={() => { logout(); setProfileOpen(false); nav("/"); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bg-soft text-sm text-red-600"><FiLogOut /> Logout</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        <button className="lg:hidden grid place-items-center h-10 w-10 rounded-full border border-line bg-white" onClick={() => setOpen(true)}>
          <FiMenu />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-0 bg-white z-50 lg:hidden overflow-y-auto">
            <div className="container-x flex items-center justify-between h-16">
              <Logo />
              <button onClick={() => setOpen(false)} className="grid place-items-center h-10 w-10 rounded-full border border-line"><FiX /></button>
            </div>
            <div className="container-x pb-10">
              {user && (
                <div className="grid gap-3 mb-6">
                  {vehicle && (
                    <div className="card-soft p-4 flex items-center gap-3">
                      <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand text-ink"><FiTruck className="text-xl" /></span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{vehicle.brand} {vehicle.model}</div>
                        <div className="text-xs text-muted">{vehicle.fuel} · {vehicle.reg}</div>
                      </div>
                    </div>
                  )}
                  <div className="card-soft p-4 flex items-center gap-3">
                    <span className="grid place-items-center h-12 w-12 rounded-2xl bg-ink text-white font-bold">{user.name[0]}</span>
                    <div><div className="font-semibold">{user.name}</div><div className="text-xs text-muted">Welcome back</div></div>
                  </div>
                </div>
              )}

              <nav className="grid gap-1 mb-6">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl hover:bg-bg-soft text-base font-medium">{n.label}</Link>
                ))}
                {user && <Link to="/dashboard" onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl hover:bg-bg-soft text-base font-medium">Dashboard</Link>}
              </nav>

              <div className="grid gap-2">
                <Link to="/booking/vehicle" onClick={() => setOpen(false)} className="btn-primary">Book Service</Link>
                {!user ? (
                  <>
                    <Link to="/login" onClick={() => setOpen(false)} className="btn-dark">Login</Link>
                    <Link to="/register" onClick={() => setOpen(false)} className="btn-ghost">Register</Link>
                  </>
                ) : (
                  <>
                    <Link to="/dashboard/vehicles" onClick={() => setOpen(false)} className="btn-ghost">My Vehicles</Link>
                    <Link to="/dashboard/bookings" onClick={() => setOpen(false)} className="btn-ghost">Active Bookings</Link>
                    <button onClick={() => { logout(); setOpen(false); nav("/"); }} className="btn-ghost text-red-600 border-red-200">Logout</button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
