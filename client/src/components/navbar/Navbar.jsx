import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiMenu,
  FiPlus,
  FiShoppingBag,
  FiTruck,
  FiX,
} from "react-icons/fi";
import Logo from "@/components/common/Logo";
import { useApp } from "@/hooks/useApp";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";

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

  const { user, vehicle, cart = [], logout } = useApp();
  const { unreadCount } = useUnreadNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const safeCart = Array.isArray(cart) ? cart : [];

  const closeDropdowns = () => {
    setProfileOpen(false);
    setVehOpen(false);
  };

  const closeMobileMenu = () => {
    setOpen(false);
    document.body.style.overflow = "";
  };

  const navigateFromMobile = (to) => {
    closeDropdowns();
    closeMobileMenu();
    navigate(to);
  };

  const handleLogout = async () => {
    closeDropdowns();
    closeMobileMenu();

    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    closeDropdowns();
    document.body.style.overflow = "";
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    document.body.style.overflow = open ? "hidden" : "";

    if (open) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={[
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-line bg-white/90 shadow-sm backdrop-blur-xl"
            : "bg-transparent",
        ].join(" ")}
      >
        <div className="container-x flex h-16 items-center justify-between sm:h-20">
          <Link
            to="/"
            className="shrink-0"
            onClick={() => {
              closeDropdowns();
              closeMobileMenu();
            }}
          >
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "relative rounded-full px-3 py-2 text-sm font-semibold transition",
                    isActive ? "text-ink" : "text-ink/70 hover:text-ink",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}

                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 -z-10 rounded-full bg-bg-soft"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 32,
                        }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {!user ? (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
                >
                  Register
                </Link>

                <Link
                  to="/booking/vehicle"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
                >
                  Book Service
                </Link>
              </>
            ) : (
              <>
                {vehicle ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setVehOpen((value) => !value);
                        setProfileOpen(false);
                      }}
                      className="flex h-10 max-w-[220px] items-center gap-2 rounded-full border border-line bg-white py-1 pl-1.5 pr-3 transition hover:border-ink"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-black">
                        <FiTruck className="text-sm" />
                      </span>

                      <span className="min-w-0 text-left text-xs leading-tight">
                        <span className="block truncate font-bold text-ink">
                          {vehicle.brand} {vehicle.model}
                        </span>
                        <span className="block truncate text-muted">
                          {vehicle.fuelType || vehicle.fuel || "Vehicle"}
                        </span>
                      </span>

                      <FiChevronDown className="shrink-0 text-muted" />
                    </button>

                    <AnimatePresence>
                      {vehOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="card-soft absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-lg"
                        >
                          <Link
                            to="/booking/vehicle"
                            onClick={() => setVehOpen(false)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-soft"
                          >
                            <FiPlus />
                            Change Vehicle
                          </Link>

                          <Link
                            to="/booking/vehicle"
                            onClick={() => setVehOpen(false)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-soft"
                          >
                            <FiPlus />
                            Add New Vehicle
                          </Link>

                          <Link
                            to="/dashboard/vehicles"
                            onClick={() => setVehOpen(false)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-soft"
                          >
                            <FiTruck />
                            My Vehicles
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    to="/booking/vehicle"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
                  >
                    <FiPlus />
                    Add Vehicle
                  </Link>
                )}

                <Link
                  to="/checkout"
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white transition hover:border-ink"
                  aria-label="Checkout"
                >
                  <FiShoppingBag />

                  {safeCart.length > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-bold text-black">
                      {safeCart.length}
                    </span>
                  )}
                </Link>

                <Link
                  to="/dashboard/notifications"
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white transition hover:border-ink"
                  aria-label="Notifications"
                >
                  <FiBell />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-bold text-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen((value) => !value);
                      setVehOpen(false);
                    }}
                    className="flex h-10 max-w-[190px] items-center gap-2 rounded-full border border-line bg-white py-1 pl-1.5 pr-3 transition hover:border-ink"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">
                      {user.name?.[0] || "U"}
                    </span>

                    <span className="truncate text-sm font-semibold text-ink">
                      {user.name || "User"}
                    </span>

                    <FiChevronDown className="shrink-0 text-muted" />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="card-soft absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-lg"
                      >
                        {[
                          ["Dashboard", "/dashboard"],
                          ["Active Bookings", "/dashboard/bookings"],
                          ["Service History", "/dashboard/history"],
                          ["Warranty Center", "/warranty"],
                          ["Profile Settings", "/dashboard/profile"],
                        ].map(([label, to]) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setProfileOpen(false)}
                            className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-soft"
                          >
                            {label}
                          </Link>
                        ))}

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <FiLogOut />
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <FiMenu />
          </button>
        </div>
      </motion.header>

      <div
        aria-hidden={!open}
        className={[
          "fixed inset-0 z-[80] h-dvh w-screen overflow-y-auto bg-white transition-transform duration-200 ease-out lg:hidden",
          open
            ? "visible translate-x-0 pointer-events-auto"
            : "invisible translate-x-full pointer-events-none",
        ].join(" ")}
      >
        <div className="container-x flex h-16 items-center justify-between">
          <button
            type="button"
            onClick={() => navigateFromMobile("/")}
            className="shrink-0"
            aria-label="Go to home page"
          >
            <Logo />
          </button>

          <button
            type="button"
            onClick={closeMobileMenu}
            className="grid h-10 w-10 place-items-center rounded-full border border-line"
            aria-label="Close menu"
          >
            <FiX />
          </button>
        </div>

        <div className="container-x pb-10">
          {user && (
            <div className="mb-5 grid gap-3">
              {vehicle && (
                <div className="card-soft flex items-center gap-3 rounded-2xl p-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-black">
                    <FiTruck className="text-xl" />
                  </span>

                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">
                      {vehicle.brand} {vehicle.model}
                    </div>

                    <div className="text-xs text-muted">
                      {vehicle.fuelType || vehicle.fuel || "Vehicle"} ·{" "}
                      {vehicle.registrationNumber ||
                        vehicle.reg ||
                        "No registration"}
                    </div>
                  </div>
                </div>
              )}

              <div className="card-soft flex items-center gap-3 rounded-2xl p-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink font-bold text-white">
                  {user.name?.[0] || "U"}
                </span>

                <div className="min-w-0">
                  <div className="truncate font-bold text-ink">
                    {user.name || "User"}
                  </div>
                  <div className="text-xs text-muted">Welcome back</div>
                </div>
              </div>
            </div>
          )}

          <nav className="mb-6 grid gap-1">
            {NAV.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => navigateFromMobile(item.to)}
                className="rounded-2xl px-4 py-3 text-left text-base font-semibold hover:bg-bg-soft"
              >
                {item.label}
              </button>
            ))}

            {user && (
              <>
                <button
                  type="button"
                  onClick={() => navigateFromMobile("/dashboard")}
                  className="rounded-2xl px-4 py-3 text-left text-base font-semibold hover:bg-bg-soft"
                >
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigateFromMobile("/dashboard/notifications")
                  }
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-left text-base font-semibold hover:bg-bg-soft"
                >
                  <span>Notifications</span>

                  {unreadCount > 0 && (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </nav>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => navigateFromMobile("/booking/vehicle")}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
            >
              Book Service
            </button>

            {!user ? (
              <>
                <button
                  type="button"
                  onClick={() => navigateFromMobile("/login")}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-white"
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => navigateFromMobile("/register")}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigateFromMobile("/dashboard/vehicles")}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink"
                >
                  My Vehicles
                </button>

                <button
                  type="button"
                  onClick={() => navigateFromMobile("/dashboard/bookings")}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink"
                >
                  Active Bookings
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
