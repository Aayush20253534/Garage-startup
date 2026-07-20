import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import CustomerAvatar from "@/components/customer/CustomerAvatar";
import { useApp } from "@/hooks/useApp";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";
import api from "@/api/axios";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const AUTHENTICATED_MOBILE_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/services", label: "Services" },
  { to: "/dashboard/notifications", label: "Notifications" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/contact", label: "Contact" },
  { to: "/about", label: "About" },
];

const formatNotificationTime = (date) => {
  if (!date) return "";

  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";

  return `${days}d ago`;
};

const sortLatestNotifications = (items) =>
  [...items].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [vehOpen, setVehOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [latestNotifications, setLatestNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const notificationsRef = useRef(null);
  const mobileNotificationsRef = useRef(null);

  const { user, vehicle, cart = [], logout } = useApp();
  const { unreadCount } = useUnreadNotifications();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const safeCart = Array.isArray(cart) ? cart : [];
  const visibleNav = NAV;
  const mobileNav = user ? AUTHENTICATED_MOBILE_NAV : NAV;

  const closeMobileMenu = () => {
    document.body.style.overflow = "";
    setOpen(false);
  };

  const closeDropdowns = () => {
    setProfileOpen(false);
    setVehOpen(false);
    setNotificationsOpen(false);
  };

  const handleMobileNavigate = (event, to) => {
    event.preventDefault();

    closeDropdowns();
    closeMobileMenu();

    // Let the full-screen drawer begin closing before changing route.
    window.requestAnimationFrame(() => {
      nav(to);
    });
  };

  const loadLatestNotifications = async () => {
    if (!user || user.role !== "CUSTOMER") {
      setLatestNotifications([]);
      return;
    }

    try {
      setNotificationsLoading(true);
      setNotificationsError("");

      const response = await api.get("/notifications");
      const items = Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      setLatestNotifications(sortLatestNotifications(items).slice(0, 3));

      window.dispatchEvent(
        new CustomEvent("rov:notifications-updated", {
          detail: {
            unreadCount: items.filter((item) => !item.isRead).length,
          },
        }),
      );
    } catch (error) {
      setNotificationsError(
        error.response?.data?.message || "Unable to load notifications",
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleNotificationToggle = async () => {
    const shouldOpen = !notificationsOpen;

    setNotificationsOpen(shouldOpen);
    setProfileOpen(false);
    setVehOpen(false);

    if (shouldOpen) {
      await loadLatestNotifications();
    }
  };

  const handleLogout = async () => {
    closeDropdowns();
    closeMobileMenu();

    try {
      await logout();
    } finally {
      nav("/", { replace: true });
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
    if (!notificationsOpen) return undefined;

    const handlePointerDown = (event) => {
      const clickedDesktopPanel = notificationsRef.current?.contains(event.target);
      const clickedMobilePanel = mobileNotificationsRef.current?.contains(event.target);

      if (clickedDesktopPanel || clickedMobilePanel) return;

      setNotificationsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

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
        <Link to="/" className="shrink-0" onClick={closeDropdowns}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "relative inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold leading-none transition-colors",
                  isActive ? "text-ink" : "text-ink/70 hover:text-ink",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative z-10">{item.label}</span>

                  {/* {isActive && (
                    <span
                      className="pointer-events-none absolute inset-0 z-0 rounded-full bg-bg-soft"
                    />
                  )} */}
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
                Signup
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
                      setNotificationsOpen(false);
                    }}
                    className="flex h-10 max-w-[220px] items-center gap-2 rounded-lg border border-line bg-white py-1 pl-1.5 pr-3 transition hover:border-ink"
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
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-soft"
                        >
                          <FiPlus />
                          Change Vehicle
                        </Link>

                        <Link
                          to="/booking/vehicle"
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-soft"
                        >
                          <FiPlus />
                          Add New Vehicle
                        </Link>

                        <Link
                          to="/dashboard/vehicles"
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

              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={handleNotificationToggle}
                  className={[
                    "relative grid h-10 w-10 place-items-center rounded-full border bg-white transition",
                    notificationsOpen
                      ? "border-ink shadow-sm"
                      : "border-line hover:border-ink",
                  ].join(" ")}
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                  aria-haspopup="dialog"
                >
                  <FiBell />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-bold text-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="absolute right-0 mt-3 w-[360px] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl shadow-ink/10"
                      role="dialog"
                      aria-label="Latest notifications"
                    >
                      <div className="border-b border-line bg-bg-soft/60 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-ink">
                              Notifications
                            </p>
                            <p className="text-xs text-muted">
                              Latest 3 platform updates
                            </p>
                          </div>

                          {unreadCount > 0 && (
                            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-black">
                              {unreadCount > 99 ? "99+" : unreadCount} unread
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="max-h-[360px] p-3">
                        {notificationsLoading ? (
                          <div className="grid gap-2">
                            {[0, 1, 2].map((item) => (
                              <div
                                key={item}
                                className="rounded-2xl border border-line bg-white p-3"
                              >
                                <div className="mb-2 h-3 w-2/3 animate-pulse rounded-full bg-bg-soft" />
                                <div className="h-3 w-full animate-pulse rounded-full bg-bg-soft" />
                              </div>
                            ))}
                          </div>
                        ) : notificationsError ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-600">
                            {notificationsError}
                          </div>
                        ) : latestNotifications.length > 0 ? (
                          <div className="grid gap-2">
                            {latestNotifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={[
                                  "rounded-2xl border bg-white p-3 transition hover:border-ink/20 hover:bg-bg-soft/40",
                                  notification.isRead
                                    ? "border-line"
                                    : "border-brand/50 shadow-sm",
                                ].join(" ")}
                              >
                                <div className="flex items-start gap-3">
                                  <span
                                    className={[
                                      "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                                      notification.isRead
                                        ? "bg-bg-soft text-muted"
                                        : "bg-brand text-black",
                                    ].join(" ")}
                                  >
                                    <FiBell />
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="line-clamp-1 text-sm font-bold text-ink">
                                        {notification.title || "Notification"}
                                      </p>
                                      <span className="shrink-0 text-[11px] font-medium text-muted">
                                        {formatNotificationTime(
                                          notification.createdAt,
                                        )}
                                      </span>
                                    </div>

                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                                      {notification.message ||
                                        "You have a new update."}
                                    </p>

                                    {notification.link && (
                                      <Link
                                        to={notification.link}
                                        onClick={() => setNotificationsOpen(false)}
                                        className="mt-2 inline-flex text-xs font-bold text-ink underline-offset-4 hover:underline"
                                      >
                                        Open update
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-line bg-bg-soft/50 px-4 py-6 text-center">
                            <p className="text-sm font-bold text-ink">
                              No notifications yet
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              New booking and payment updates will appear here.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-line bg-white px-3 py-3">
                        <Link
                          to="/dashboard/notifications"
                          onClick={() => setNotificationsOpen(false)}
                          className="flex h-10 items-center justify-center rounded-xl border border-line bg-white text-sm font-bold text-ink transition hover:border-ink/25 hover:bg-bg-soft"
                        >
                          View all notifications
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((value) => !value);
                    setVehOpen(false);
                    setNotificationsOpen(false);
                  }}
                  className="flex h-10 max-w-[190px] items-center gap-2 rounded-lg border border-line bg-white py-1 pl-1.5 pr-3 transition hover:border-ink"
                >
                  <CustomerAvatar
                    user={user}
                    className="h-8 w-8 text-xs"
                    fallbackClassName="bg-ink text-white"
                  />

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

        <div className="flex items-center gap-2 lg:hidden">
          {user && (
            <div ref={mobileNotificationsRef} className="relative">
              <button
                type="button"
                onClick={handleNotificationToggle}
                className={[
                  "relative grid h-10 w-10 place-items-center rounded-full border bg-white transition",
                  notificationsOpen
                    ? "border-ink shadow-sm"
                    : "border-line hover:border-ink",
                ].join(" ")}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
              >
                <FiBell />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand px-1.5 text-center text-[10px] font-bold text-black">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="fixed left-4 right-4 top-[72px] z-[60] max-h-[calc(100dvh-96px)] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl shadow-ink/10 sm:left-auto sm:right-6 sm:w-[360px]"
                    role="dialog"
                    aria-label="Latest notifications"
                  >
                    <div className="border-b border-line bg-bg-soft/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-ink">
                            Notifications
                          </p>
                          <p className="text-xs text-muted">
                            Latest 3 platform updates
                          </p>
                        </div>

                        {unreadCount > 0 && (
                          <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-black">
                            {unreadCount > 99 ? "99+" : unreadCount} unread
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="max-h-[calc(100dvh-210px)] overflow-y-auto p-3">
                      {notificationsLoading ? (
                        <div className="grid gap-2">
                          {[0, 1, 2].map((item) => (
                            <div
                              key={item}
                              className="rounded-2xl border border-line bg-white p-3"
                            >
                              <div className="mb-2 h-3 w-2/3 animate-pulse rounded-full bg-bg-soft" />
                              <div className="h-3 w-full animate-pulse rounded-full bg-bg-soft" />
                            </div>
                          ))}
                        </div>
                      ) : notificationsError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-600">
                          {notificationsError}
                        </div>
                      ) : latestNotifications.length > 0 ? (
                        <div className="grid gap-2">
                          {latestNotifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={[
                                "rounded-2xl border bg-white p-3 transition hover:border-ink/20 hover:bg-bg-soft/40",
                                notification.isRead
                                  ? "border-line"
                                  : "border-brand/50 shadow-sm",
                              ].join(" ")}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={[
                                    "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                                    notification.isRead
                                      ? "bg-bg-soft text-muted"
                                      : "bg-brand text-black",
                                  ].join(" ")}
                                >
                                  <FiBell />
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="line-clamp-1 text-sm font-bold text-ink">
                                      {notification.title || "Notification"}
                                    </p>
                                    <span className="shrink-0 text-[11px] font-medium text-muted">
                                      {formatNotificationTime(
                                        notification.createdAt,
                                      )}
                                    </span>
                                  </div>

                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                                    {notification.message ||
                                      "You have a new update."}
                                  </p>

                                  {notification.link && (
                                    <Link
                                      to={notification.link}
                                      onClick={() => setNotificationsOpen(false)}
                                      className="mt-2 inline-flex text-xs font-bold text-ink underline-offset-4 hover:underline"
                                    >
                                      Open update
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-line bg-bg-soft/50 px-4 py-6 text-center">
                          <p className="text-sm font-bold text-ink">
                            No notifications yet
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            New booking and payment updates will appear here.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-line bg-white px-3 py-3">
                      <Link
                        to="/dashboard/notifications"
                        onClick={(event) =>
                          handleMobileNavigate(event, "/dashboard/notifications")
                        }
                        className="flex h-10 items-center justify-center rounded-xl border border-line bg-white text-sm font-bold text-ink transition hover:border-ink/25 hover:bg-bg-soft"
                      >
                        View all notifications
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white"
            onClick={() => {
              closeDropdowns();
              setOpen(true);
            }}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <FiMenu />
          </button>
        </div>
      </div>

      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.18 }}
            className="fixed inset-0 z-50 h-dvh w-screen overflow-y-auto bg-white lg:hidden"
          >
            <div className="container-x flex h-16 items-center justify-between">
              <Link
                to="/"
                onClick={(event) => handleMobileNavigate(event, "/")}
                className="shrink-0"
              >
                <Logo />
              </Link>

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
                    <Link
                      to="/dashboard/vehicles"
                      onClick={(event) =>
                        handleMobileNavigate(event, "/dashboard/vehicles")
                      }
                      className="card-soft flex items-center gap-3 rounded-2xl p-4 transition hover:border-ink/25 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                      aria-label="Open My Vehicles"
                    >
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
                    </Link>
                  )}

                  <Link
                    to="/dashboard/profile"
                    onClick={(event) =>
                      handleMobileNavigate(event, "/dashboard/profile")
                    }
                    className="card-soft flex items-center gap-3 rounded-2xl p-4 transition hover:border-ink/25 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                    aria-label="Open customer profile"
                  >
                    <CustomerAvatar
                      user={user}
                      className="h-12 w-12 text-base"
                      fallbackClassName="bg-ink text-white"
                    />

                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink">
                        {user.name || "User"}
                      </div>
                      <div className="text-xs text-muted">Welcome back</div>
                    </div>
                  </Link>
                </div>
              )}

              <nav className="mb-6 grid gap-1">
                {mobileNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={(event) =>
                      handleMobileNavigate(event, item.to)
                    }
                    className="flex items-center justify-between rounded-2xl px-4 py-3 text-base font-semibold hover:bg-bg-soft"
                  >
                    <span>{item.label}</span>
                    {item.to === "/dashboard/notifications" &&
                      unreadCount > 0 && (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                  </Link>
                ))}
              </nav>

              <div className="grid gap-2">
                <Link
                  to="/booking/vehicle"
                  onClick={(event) =>
                    handleMobileNavigate(event, "/booking/vehicle")
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark"
                >
                  Book Service
                </Link>

                {!user ? (
                  <>
                    <Link
                      to="/login"
                      onClick={(event) =>
                        handleMobileNavigate(event, "/login")
                      }
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-white"
                    >
                      Login
                    </Link>

                    <Link
                      to="/register"
                      onClick={(event) =>
                        handleMobileNavigate(event, "/register")
                      }
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink"
                    >
                      Signup
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/dashboard/bookings"
                      onClick={(event) =>
                        handleMobileNavigate(event, "/dashboard/bookings")
                      }
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-ink"
                    >
                      Active Bookings
                    </Link>

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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
