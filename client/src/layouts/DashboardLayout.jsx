import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Logo from "@/components/common/Logo";
import FAB from "@/components/FAB";
import { useApp } from "@/hooks/useApp";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";
import { FiLogOut, FiMenu, FiX } from "react-icons/fi";

export default function DashboardLayout({ items = [], title = "Dashboard" }) {
  const { pathname } = useLocation();
  const { user, garage, logout, logoutGarage } = useApp();
  const { unreadCount } = useUnreadNotifications();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const isGaragePortal = pathname.startsWith("/garage");
  const isAdminPortal = pathname.startsWith("/admin");
  const showCustomerAssistant = !isGaragePortal && !isAdminPortal;

  const account = isGaragePortal ? garage : user;

  const accountName = isGaragePortal
    ? account?.ownerName || account?.owner?.name || account?.name
    : account?.name;

  const accountRole = isGaragePortal
    ? "GARAGE OWNER"
    : isAdminPortal
      ? "ADMIN"
      : account?.role || "CUSTOMER";

  const accountInitial = accountName?.charAt(0)?.toUpperCase() || "R";

  const isDashboardLink = (to) =>
    ["/dashboard", "/customer/dashboard", "/dashboard/customer", "/garage", "/admin"].includes(
      to
    );

  const visibleItems = useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  useEffect(() => {
    setOpen(false);
    document.body.style.overflow = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleLogout = async () => {
    if (isGaragePortal) {
      await logoutGarage();
      navigate("/garage/login", { replace: true });
      return;
    }

    await logout();
    navigate(isAdminPortal ? "/admin/login" : "/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg-soft lg:flex">
      {open && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-white shadow-xl transition-transform duration-300",
          "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <Logo />

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line transition hover:border-ink hover:bg-bg-soft lg:hidden"
          >
            <FiX />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="grid gap-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={isDashboardLink(item.to)}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-ink text-white"
                        : "text-ink/70 hover:bg-bg-soft hover:text-ink",
                    ].join(" ")
                  }
                >
                  {Icon && <Icon className="shrink-0 text-lg" />}

                  <span className="truncate">{item.label}</span>

                  {item.to === "/dashboard/notifications" &&
                    unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-line bg-white p-4">
          <div className="flex items-center gap-3 rounded-xl bg-bg-soft px-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-base font-bold text-black">
              {accountInitial}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {accountName || "Guest"}
              </p>
              <p className="truncate text-xs font-bold uppercase text-muted">
                {accountRole}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
          >
            <FiLogOut />
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-xl">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setOpen(true)}
              className="mr-3 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line transition hover:border-ink hover:bg-bg-soft lg:hidden"
            >
              <FiMenu />
            </button>

            <h1 className="truncate text-lg font-bold text-ink">{title}</h1>
          </div>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="min-w-0 p-4 sm:p-6 lg:p-8"
        >
          <Outlet />
        </motion.main>
      </div>

      {showCustomerAssistant && <FAB />}
    </div>
  );
}