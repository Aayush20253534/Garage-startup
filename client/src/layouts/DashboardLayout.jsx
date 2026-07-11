import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Logo from "@/components/common/Logo";
import SupportBrand from "@/components/support/SupportBrand";
import StaffBrand from "@/components/staff/StaffBrand";
import FAB from "@/components/FAB";
import { useApp } from "@/hooks/useApp";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";
import useOpenSystemIssueCount from "@/hooks/useOpenSystemIssueCount";
import useCustomerSupportUnreadNotifications from "@/hooks/useCustomerSupportUnreadNotifications";
import { FiLogOut, FiMenu, FiX } from "react-icons/fi";

export default function DashboardLayout({ items = [], title = "Dashboard" }) {
  const { pathname } = useLocation();
  const { user, garage, logout, logoutGarage } = useApp();
  const { unreadCount } = useUnreadNotifications();
  const { unreadCount: supportUnreadCount } =
    useCustomerSupportUnreadNotifications();
  const isAdminPortal = pathname.startsWith("/admin");
  const isInternPortal = pathname.startsWith("/intern");
  const isCustomerSupportPortal =
    pathname === "/support" || pathname.startsWith("/support/");
  const isCustomerPortal =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isStaffPortal = isAdminPortal || isInternPortal;
  const hasDedicatedPortalBrand = isStaffPortal || isCustomerSupportPortal;
  const usesFixedPortalShell = isCustomerSupportPortal || isCustomerPortal;

  const { openIssueCount } = useOpenSystemIssueCount({
    enabled: isStaffPortal,
  });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isGaragePortal = pathname.startsWith("/garage");
  const showCustomerAssistant =
    !isGaragePortal && !isStaffPortal && !isCustomerSupportPortal;
  const account = isGaragePortal ? garage : user;
  const accountName = isGaragePortal
    ? account?.ownerName || account?.owner?.name || account?.name
    : account?.name;
  const accountRole = isGaragePortal
    ? "GARAGE OWNER"
    : isAdminPortal
      ? "ADMIN"
      : isInternPortal
        ? "INTERN"
        : isCustomerSupportPortal
          ? "CUSTOMER SUPPORT"
          : account?.role || "CUSTOMER";
  const accountInitial = accountName?.charAt(0)?.toUpperCase() || "R";

  const isDashboardLink = (to) =>
    [
      "/dashboard",
      "/customer/dashboard",
      "/dashboard/customer",
      "/garage",
      "/admin",
      "/intern",
      "/support",
    ].includes(to);

  const visibleItems = useMemo(
    () => (Array.isArray(items) ? items : []),
    [items],
  );

  const mobileItems = useMemo(() => {
    if (isCustomerPortal) {
      const preferredPaths = [
        "/dashboard",
        "/dashboard/vehicles",
        "/booking/vehicle",
        "/dashboard/bookings",
        "/dashboard/notifications",
      ];

      return preferredPaths
        .map((path) => visibleItems.find((item) => item.to === path))
        .filter(Boolean);
    }

    return visibleItems.slice(0, 5);
  }, [isCustomerPortal, visibleItems]);

  const closeSidebar = () => {
    setOpen(false);
    document.body.style.overflow = "";
  };

  useEffect(() => {
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeSidebar();
    };

    document.body.style.overflow = open ? "hidden" : "";

    if (open) window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleLogout = async () => {
    closeSidebar();

    if (isGaragePortal) {
      await logoutGarage();
      navigate("/garage/login", { replace: true });
      return;
    }

    await logout();

    if (isAdminPortal) {
      navigate("/admin/login", { replace: true });
      return;
    }

    if (isInternPortal) {
      navigate("/intern/login", { replace: true });
      return;
    }

    if (isCustomerSupportPortal) {
      navigate("/support/login", { replace: true });
      return;
    }

    navigate("/", { replace: true });
  };

  const badgeForItem = (item) => {
    if (item.to === "/dashboard/notifications") return unreadCount;
    if (item.to === "/support/notify") return supportUnreadCount;
    if (item.to.endsWith("/system-issues")) return openIssueCount;
    return 0;
  };

  const renderPortalBrand = ({ compact = false } = {}) => {
    if (isCustomerSupportPortal) {
      return <SupportBrand compact={compact} />;
    }

    if (isAdminPortal) {
      return <StaffBrand portal="admin" compact={compact} />;
    }

    if (isInternPortal) {
      return <StaffBrand portal="intern" compact={compact} />;
    }

    return <Logo />;
  };

  const renderNavItem = (item, { mobile = false } = {}) => {
    const Icon = item.icon;
    const badge = badgeForItem(item);

    if (mobile) {
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={isDashboardLink(item.to)}
          className={({ isActive }) =>
            [
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold transition",
              isActive ? "bg-ink text-white" : "text-slate-500",
            ].join(" ")
          }
        >
          {Icon && <Icon className="text-lg" />}
          <span className="w-full truncate text-center">{item.label}</span>
          {badge > 0 && (
            <span className="absolute right-1.5 top-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-extrabold text-black">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </NavLink>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={isDashboardLink(item.to)}
        onClick={closeSidebar}
        className={({ isActive }) =>
          [
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
            isActive
              ? "bg-ink text-white shadow-sm"
              : "text-ink/70 hover:bg-bg-soft hover:text-ink",
          ].join(" ")
        }
      >
        {Icon && <Icon className="shrink-0 text-lg" />}
        <span className="truncate">{item.label}</span>
        {badge > 0 && (
          <span
            className={[
              "ml-auto rounded-full px-2 py-0.5 text-xs font-bold",
              item.to.endsWith("/system-issues")
                ? "bg-red-600 text-white"
                : "bg-brand text-black",
            ].join(" ")}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div
      className={[
        "min-h-screen overflow-x-hidden bg-bg-soft",
        usesFixedPortalShell ? "lg:block" : "lg:flex",
      ].join(" ")}
    >
      {open && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-white shadow-xl transition-transform duration-300",
          usesFixedPortalShell
            ? "lg:fixed lg:top-0 lg:z-30 lg:h-screen lg:w-[264px] lg:translate-x-0 lg:shadow-none"
            : "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-4">
          {renderPortalBrand({ compact: true })}

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={closeSidebar}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line transition hover:border-ink hover:bg-bg-soft lg:hidden"
          >
            <FiX />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 py-4">
          <div className="grid gap-1">
            {visibleItems.map((item) => renderNavItem(item))}
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
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      <div
        className={[
          "min-w-0 flex-1 overflow-x-hidden",
          usesFixedPortalShell ? "lg:ml-[264px]" : "",
        ].join(" ")}
      >
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-xl">
          <div className="flex h-16 items-center px-3 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setOpen(true)}
              className="mr-3 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line transition hover:border-ink hover:bg-bg-soft lg:hidden"
            >
              <FiMenu />
            </button>

            {hasDedicatedPortalBrand ? (
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 lg:hidden">
                  {renderPortalBrand({ compact: true })}
                </div>
                <h1 className="hidden truncate text-lg font-bold text-ink lg:block">
                  {title}
                </h1>
              </div>
            ) : (
              <h1 className="truncate text-lg font-bold text-ink">{title}</h1>
            )}
          </div>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={[
            "w-full min-w-0 max-w-full overflow-x-hidden",
            usesFixedPortalShell
              ? "mx-auto max-w-[1600px] px-3 pb-28 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-7 xl:px-8"
              : "p-4 sm:p-6 lg:p-8",
          ].join(" ")}
        >
          <Outlet />
        </motion.main>
      </div>

      {(isCustomerSupportPortal || isCustomerPortal) && (
        <nav
          aria-label={
            isCustomerSupportPortal
              ? "Support portal navigation"
              : "Customer portal navigation"
          }
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-lg gap-1">
            {mobileItems.map((item) =>
              renderNavItem(item, { mobile: true }),
            )}
          </div>
        </nav>
      )}

      {showCustomerAssistant && <FAB />}
    </div>
  );
}
