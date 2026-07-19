const routeLoaders = {
  "/dashboard": () => import("@/pages/customer/Dashboard"),
  "/dashboard/vehicles": () => import("@/pages/customer/MyVehicles"),
  "/dashboard/bookings": () => import("@/pages/customer/ActiveBookings"),
  "/dashboard/pending-bookings": () =>
    import("@/pages/customer/PendingBookings"),
  "/dashboard/history": () => import("@/pages/customer/ServiceHistory"),
  "/dashboard/profile": () => import("@/pages/customer/Profile"),
  "/dashboard/payments": () => import("@/pages/customer/Payments"),
  "/dashboard/notifications": () =>
    import("@/pages/customer/Notifications"),
  "/dashboard/support": () => import("@/pages/customer/Support"),
  "/booking/address": () => import("@/pages/booking/AddressForm"),
  "/booking/vehicle": () => import("@/pages/booking/VehicleSelect"),
  "/booking/services": () => import("@/pages/booking/ServiceSelect"),
  "/checkout": () => import("@/pages/booking/Checkout"),
  "/tracking": () => import("@/pages/booking/Tracking"),
};

const preloadPromises = new Map();

const getPathname = (value = "") => {
  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return String(value || "").split(/[?#]/, 1)[0];
  }
};

const isConstrainedConnection = () => {
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection) return false;

  return Boolean(
    connection.saveData ||
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g",
  );
};

const scheduleIdle = (callback, timeout = 2200) => {
  if (typeof window === "undefined") return () => {};

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, Math.min(timeout, 1200));
  return () => window.clearTimeout(id);
};

export const preloadCustomerRoute = (path) => {
  if (typeof window === "undefined") return Promise.resolve(null);

  const pathname = getPathname(path);
  const loader = routeLoaders[pathname];

  if (!loader) return Promise.resolve(null);

  if (!preloadPromises.has(pathname)) {
    preloadPromises.set(
      pathname,
      loader().catch((error) => {
        preloadPromises.delete(pathname);
        throw error;
      }),
    );
  }

  return preloadPromises.get(pathname);
};

export const preloadCustomerPortal = ({
  targetPath = "/dashboard",
  includeSecondary = true,
} = {}) => {
  const primaryPaths = Array.from(
    new Set([targetPath, "/dashboard", "/booking/vehicle"]),
  );

  primaryPaths.forEach((path) => {
    preloadCustomerRoute(path).catch(() => null);
  });

  if (!includeSecondary || isConstrainedConnection()) {
    return () => {};
  }

  return scheduleIdle(() => {
    [
      "/dashboard/vehicles",
      "/dashboard/bookings",
      "/dashboard/pending-bookings",
      "/dashboard/history",
      "/dashboard/profile",
    ].forEach((path) => {
      preloadCustomerRoute(path).catch(() => null);
    });
  });
};
