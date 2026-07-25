import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/common/Logo";
import CustomerAvatar from "@/components/customer/CustomerAvatar";
import SupportBrand from "@/components/support/SupportBrand";
import StaffBrand from "@/components/staff/StaffBrand";
import FAB from "@/components/FAB";
import { useApp } from "@/hooks/useApp";
import useUnreadNotifications from "@/hooks/useUnreadNotifications";
import useOpenSystemIssueCount from "@/hooks/useOpenSystemIssueCount";
import useCustomerSupportUnreadNotifications from "@/hooks/useCustomerSupportUnreadNotifications";
import { FiLogOut, FiMenu, FiShield, FiUserCheck, FiX } from "react-icons/fi";
import {
  preloadCustomerPortal,
  preloadCustomerRoute,
} from "@/utils/customerPreload";

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
  const isGaragePortal =
    pathname === "/garage" || pathname.startsWith("/garage/");
  const isStaffPortal = isAdminPortal || isInternPortal;
  const hasDedicatedPortalBrand = isStaffPortal || isCustomerSupportPortal;
  const usesFixedPortalShell =
    isStaffPortal ||
    isCustomerSupportPortal ||
    isCustomerPortal ||
    isGaragePortal;

  const { openIssueCount } = useOpenSystemIssueCount({
    enabled: isStaffPortal,
  });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const showCustomerAssistant =
    !isGaragePortal && !isStaffPortal && !isCustomerSupportPortal;
  const account = isGaragePortal ? garage : user;
  const accountName = isGaragePortal
    ? account?.ownerName || account?.owner?.name || account?.name
    : account?.name;
  const accountRole = isGaragePortal
    ? "GARAGE OWNER"
    : isAdminPortal
      ? account?.role === "SUB_ADMIN" ? "ADMIN" : "MAIN ADMIN"
      : isInternPortal
        ? "INTERN"
        : isCustomerSupportPortal
          ? "CUSTOMER SUPPORT"
          : account?.role || "CUSTOMER";
  const accountIdentifier = account?.email || account?.loginId || account?.phone || "Account identifier unavailable";
  const accountLoginId = account?.loginId && account?.loginId !== account?.email
    ? account.loginId
    : null;
  const accountSummary = (
    <>
      <CustomerAvatar
        user={isCustomerPortal ? account : null}
        name={accountName}
        className="h-10 w-10 text-base"
        fallbackClassName="bg-brand text-black"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">
          {accountName || "Guest"}
        </p>
        <p className="truncate text-xs font-bold uppercase text-muted">
          {accountRole}
        </p>
      </div>
    </>
  );

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
    () => (Array.isArray(items) ? items.filter((item) => !item.mainAdminOnly || user?.role === "ADMIN") : []),
    [items, user?.role],
  );

  const closeSidebar = () => {
    setOpen(false);
    document.body.style.overflow = "";
  };

  useEffect(() => {
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    if (!isCustomerPortal) return undefined;

    return preloadCustomerPortal({ targetPath: pathname });
  }, [isCustomerPortal, pathname]);

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

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const badge = badgeForItem(item);
    const warmRoute = () => {
      if (!isCustomerPortal) return;
      preloadCustomerRoute(item.to).catch(() => null);
    };


    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={isDashboardLink(item.to)}
        onMouseEnter={warmRoute}
        onFocus={warmRoute}
        onTouchStart={warmRoute}
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
          {isCustomerPortal ? (
            <Link
              to="/dashboard/profile"
              onClick={closeSidebar}
              aria-label="Open customer profile"
              className="flex items-center gap-3 rounded-xl bg-bg-soft px-3 py-3 transition hover:bg-line/60 focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              {accountSummary}
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-bg-soft px-3 py-3">
              {accountSummary}
            </div>
          )}

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

        {isAdminPortal && account?.accountType === "STAFF" && (
          <section className="border-b border-line bg-white">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-7 xl:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                  <FiUserCheck className="text-xl" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted">Currently signed in</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-extrabold uppercase text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Active session
                    </span>
                  </div>
                  <p className="mt-1 truncate text-base font-extrabold text-ink">{accountName || "Staff account"}</p>
                  <p className="truncate text-sm text-muted">{accountIdentifier}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg-soft px-3 py-2 text-xs font-extrabold text-ink">
                  <FiShield /> {accountRole}
                </span>
                {accountLoginId && (
                  <span className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted">
                    Login ID: <span className="font-extrabold text-ink">{accountLoginId}</span>
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        <main
          key={pathname}
          className={[
            "w-full min-w-0 max-w-full overflow-x-hidden",
            usesFixedPortalShell
              ? "mx-auto max-w-[1600px] px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-7 xl:px-8"
              : "p-4 sm:p-6 lg:p-8",
          ].join(" ")}
        >
          <Outlet />
        </main>
      </div>


      {showCustomerAssistant && <FAB />}
    </div>
  );
}
