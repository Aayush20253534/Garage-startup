import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import api from "@/api/axios";
import { garageApi } from "@/api/garage";
import {
  disablePushNotifications,
  syncExistingPushSubscription,
} from "@/utils/pushNotifications";
import { getLocationStateFromUser } from "@/utils/address";
import {
  clearCustomerState,
  selectCustomerState,
  setCustomerLocation,
  setCustomerUser,
  setCustomerVehicle,
  setCustomerVehicles,
  syncCustomerBundle,
} from "@/store/customerSlice";
import {
  clearGarageState,
  selectGarageState,
  setGarage,
} from "@/store/garageSlice";
import {
  selectBookingState,
  setBookingCart,
  setBookingCartContext,
} from "@/store/bookingSlice";
import { queryKeys } from "@/lib/query/queryKeys";
import { getCartPricingContextKey } from "@/utils/bookingCart";
import {
  normalizeServiceFulfillmentMode,
} from "@/utils/serviceFulfillment";

const AppCtx = createContext(null);

const DASHBOARD_CACHE_TTL = 5 * 60 * 1000;
const SERVICES_CACHE_TTL = 30 * 60 * 1000;
const VEHICLE_META_CACHE_TTL = 24 * 60 * 60 * 1000;
const VEHICLES_CACHE_TTL = 5 * 60 * 1000;
const ACTIVE_BOOKINGS_CACHE_TTL = 60 * 1000;
const SERVICE_HISTORY_CACHE_TTL = 5 * 60 * 1000;
const PROFILE_CACHE_TTL = 5 * 60 * 1000;
const CART_CACHE_KEY = "rov_booking_cart";
const CART_CONTEXT_CACHE_KEY = "rov_booking_cart_context";

const isConstrainedConnection = () => {
  if (typeof navigator === "undefined") return false;

  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection) return false;

  return Boolean(
    connection.saveData ||
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g",
  );
};

const scheduleIdleTask = (callback, timeout = 2500) => {
  if (typeof window === "undefined") return () => {};

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, Math.min(timeout, 1400));
  return () => window.clearTimeout(id);
};

const SESSION_ROLE_KEY = "rov_session_role";
const SESSION_ACCOUNT_TYPE_KEY = "rov_session_account_type";
const SUPPORT_SESSION_ROLE_KEY = "rov_support_session_role";
const SUPPORT_SESSION_ACCOUNT_TYPE_KEY = "rov_support_session_account_type";
const SUPPORT_USER_KEY = "rov_support_user";

const isSupportPortalPath = (pathname = window.location.pathname) =>
  pathname === "/support" || pathname.startsWith("/support/");

const VALID_SESSION_ROLES = new Set([
  "CUSTOMER",
  "GARAGE_OWNER",
  "GARAGE_CONTROLLER",
  "ADMIN",
  "SUB_ADMIN",
  "INTERN",
  "CUSTOMER_SUPPORT",
]);

const ROLE_ACCOUNT_TYPES = {
  CUSTOMER: "USER",
  GARAGE_OWNER: "USER",
  GARAGE_CONTROLLER: "GARAGE_CONTROLLER",
  ADMIN: "STAFF",
  SUB_ADMIN: "STAFF",
  INTERN: "STAFF",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
};

const getExpectedAccountType = (role) => ROLE_ACCOUNT_TYPES[role] || null;

const normalizeSessionAccount = (account) => {
  if (!account || !VALID_SESSION_ROLES.has(account.role)) {
    return account || null;
  }

  const expectedAccountType = getExpectedAccountType(account.role);

  if (!expectedAccountType) {
    return account;
  }

  return {
    ...account,
    accountType: account.accountType || expectedAccountType,
  };
};

const isValidSessionIdentity = (account) => {
  const normalizedAccount = normalizeSessionAccount(account);

  return Boolean(
    normalizedAccount &&
      VALID_SESSION_ROLES.has(normalizedAccount.role) &&
      getExpectedAccountType(normalizedAccount.role) ===
        normalizedAccount.accountType,
  );
};

const setSessionRole = (role, accountType = getExpectedAccountType(role)) => {
  if (!VALID_SESSION_ROLES.has(role)) {
    return false;
  }

  const expectedAccountType = getExpectedAccountType(role);

  if (accountType && expectedAccountType !== accountType) {
    return false;
  }

  const supportSession = role === "CUSTOMER_SUPPORT";
  localStorage.setItem(
    supportSession ? SUPPORT_SESSION_ROLE_KEY : SESSION_ROLE_KEY,
    role,
  );
  localStorage.setItem(
    supportSession
      ? SUPPORT_SESSION_ACCOUNT_TYPE_KEY
      : SESSION_ACCOUNT_TYPE_KEY,
    expectedAccountType,
  );

  return true;
};

const clearSessionRole = ({ support = false } = {}) => {
  localStorage.removeItem(
    support ? SUPPORT_SESSION_ROLE_KEY : SESSION_ROLE_KEY,
  );
  localStorage.removeItem(
    support
      ? SUPPORT_SESSION_ACCOUNT_TYPE_KEY
      : SESSION_ACCOUNT_TYPE_KEY,
  );
};

const clearLegacySupportStorage = () => {
  const legacyRole = localStorage.getItem(SESSION_ROLE_KEY);
  const legacyUser = readJson("rov_user", null) || readJson("user", null);

  if (legacyRole === "CUSTOMER_SUPPORT") {
    clearSessionRole();
  }

  if (legacyUser?.role === "CUSTOMER_SUPPORT") {
    localStorage.removeItem("user");
    localStorage.removeItem("rov_user");
  }
};

const readJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const setSessionCache = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    localStorage.setItem(key, value);
    return;
  }

  localStorage.removeItem(key);
};

const removeSessionCache = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access failures and still clear persistent fallback.
  }

  localStorage.removeItem(key);
};

const getVehicleSelectionFromList = (vehicles = [], currentVehicle = null) => {
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const currentVehicleId = currentVehicle?.id;

  return (
    safeVehicles.find((item) => item?.id === currentVehicleId) ||
    safeVehicles.find((item) => item?.isDefault) ||
    safeVehicles[0] ||
    null
  );
};


const getStoredSessionRole = () => {
  const supportPortal = isSupportPortalPath();
  const roleKey = supportPortal
    ? SUPPORT_SESSION_ROLE_KEY
    : SESSION_ROLE_KEY;
  const accountTypeKey = supportPortal
    ? SUPPORT_SESSION_ACCOUNT_TYPE_KEY
    : SESSION_ACCOUNT_TYPE_KEY;
  const explicitRole = localStorage.getItem(roleKey);
  const explicitAccountType = localStorage.getItem(accountTypeKey);

  if (VALID_SESSION_ROLES.has(explicitRole)) {
    const expectedAccountType = getExpectedAccountType(explicitRole);
    const roleMatchesPortal = supportPortal
      ? explicitRole === "CUSTOMER_SUPPORT"
      : explicitRole !== "CUSTOMER_SUPPORT";

    if (
      roleMatchesPortal &&
      (!explicitAccountType || explicitAccountType === expectedAccountType)
    ) {
      setSessionRole(explicitRole, expectedAccountType);
      return explicitRole;
    }
  }

  const pathname = window.location.pathname;

  if (supportPortal) {
    const cachedSupport = normalizeSessionAccount(
      readJson(SUPPORT_USER_KEY, null),
    );

    if (
      isValidSessionIdentity(cachedSupport) &&
      cachedSupport.role === "CUSTOMER_SUPPORT"
    ) {
      setSessionRole(cachedSupport.role, cachedSupport.accountType);
      return cachedSupport.role;
    }

    return null;
  }

  const cachedUser = normalizeSessionAccount(
    readJson("rov_user", null) || readJson("user", null),
  );
  const cachedGarage = readJson("garage", null);

  if (pathname.startsWith("/garage") && cachedGarage) {
    const role = cachedGarage.role || cachedGarage.sessionUser?.role || "GARAGE_OWNER";
    const accountType = cachedGarage.accountType || cachedGarage.sessionUser?.accountType || (role === "GARAGE_CONTROLLER" ? "GARAGE_CONTROLLER" : "USER");
    setSessionRole(role, accountType);
    return role;
  }

  if (
    pathname.startsWith("/admin") &&
    isValidSessionIdentity(cachedUser) &&
    ["ADMIN", "SUB_ADMIN"].includes(cachedUser.role)
  ) {
    setSessionRole(cachedUser.role, cachedUser.accountType);
    return cachedUser.role;
  }

  if (
    pathname.startsWith("/intern") &&
    isValidSessionIdentity(cachedUser) &&
    cachedUser.role === "INTERN"
  ) {
    setSessionRole(cachedUser.role, cachedUser.accountType);
    return "INTERN";
  }

  if (
    isValidSessionIdentity(cachedUser) &&
    cachedUser.role !== "CUSTOMER_SUPPORT"
  ) {
    setSessionRole(cachedUser.role, cachedUser.accountType);
    return cachedUser.role;
  }

  if (cachedGarage) {
    const role = cachedGarage.role || "GARAGE_OWNER";
    setSessionRole(role, role === "GARAGE_CONTROLLER" ? "GARAGE_CONTROLLER" : "USER");
    return role;
  }

  return null;
};

const isProtectedPath = (pathname = window.location.pathname) => {
  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/booking/") ||
    pathname === "/checkout" ||
    pathname === "/tracking"
  ) {
    return true;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return !(pathname === "/admin/login" || pathname === "/admin/forgot-password");
  }

  if (pathname === "/intern" || pathname.startsWith("/intern/")) {
    return !(
      pathname === "/intern/login" ||
      pathname === "/intern/forgot-password"
    );
  }

  if (pathname === "/support" || pathname.startsWith("/support/")) {
    return pathname !== "/support/login";
  }

  if (pathname === "/garage") {
    return true;
  }

  if (pathname.startsWith("/garage/")) {
    return !(
      pathname === "/garage/login" ||
      pathname === "/garage/otp-login" ||
      pathname === "/garage/forgot-password" ||
      pathname === "/garage/onboarding" ||
      pathname.startsWith("/garage/magic/") ||
      pathname.startsWith("/garage/requests/")
    );
  }

  return false;
};

export function AppProvider({ children }) {
  const dispatch = useDispatch();

  const queryClient = useQueryClient();
  const { user, vehicle, vehicles, location } =
    useSelector(selectCustomerState);
  const { garage: garageUser } = useSelector(selectGarageState);
  const { cart, cartContextKey } = useSelector(selectBookingState);
  const [authLoading, setAuthLoading] = useState(true);

  // Redux owns customer-created booking state. Server-owned API data is kept
  // in TanStack Query instead of hand-written browser/session caches.
  const cartRef = useRef(cart);
  const cartContextKeyRef = useRef(
    cartContextKey || getCartPricingContextKey(vehicle, location),
  );
  const selectedVehicleRef = useRef(vehicle);
  const selectedLocationRef = useRef(location);

  cartRef.current = cart;
  cartContextKeyRef.current =
    cartContextKey || getCartPricingContextKey(vehicle, location);
  selectedVehicleRef.current = vehicle;
  selectedLocationRef.current = location;

  const authRequestRef = useRef(null);
  const preserveCartContextChangeRef = useRef(false);
  const preservedHydrationContextKeysRef = useRef(new Set());
  const garageRequestRef = useRef(null);
  const customerPreloadRef = useRef({
    userId: null,
    cancel: null,
    secondaryScheduled: false,
  });

  const setCart = useCallback((value) => {
    const nextCart =
      typeof value === "function" ? value(cartRef.current) : value;
    const safeCart = Array.isArray(nextCart) ? nextCart : [];
    cartRef.current = safeCart;
    dispatch(setBookingCart(safeCart));
  }, [dispatch]);

  const setCartContextKey = useCallback((value) => {
    const nextValue =
      typeof value === "function"
        ? value(cartContextKeyRef.current)
        : value;
    const safeValue = String(nextValue || "");
    cartContextKeyRef.current = safeValue;
    dispatch(setBookingCartContext(safeValue));
  }, [dispatch]);

  const clearCustomerSession = ({
    clearRole = true,
    preserveCart = false,
  } = {}) => {
    // Remove legacy JWT storage left by older frontend versions.
    localStorage.removeItem("token");

    localStorage.removeItem("user");
    localStorage.removeItem("rov_user");
    localStorage.removeItem("rov_location");
    localStorage.removeItem("rov_vehicle");
    localStorage.removeItem("rov_vehicles");

    dispatch(clearCustomerState());
    selectedVehicleRef.current = null;
    selectedLocationRef.current = null;

    if (!preserveCart) {
      setCart([]);
      cartRef.current = [];
      const emptyContextKey = getCartPricingContextKey(null, null);
      setCartContextKey(emptyContextKey);
      cartContextKeyRef.current = emptyContextKey;
      preservedHydrationContextKeysRef.current.clear();
      removeSessionCache(CART_CACHE_KEY);
      removeSessionCache(CART_CONTEXT_CACHE_KEY);
    }

    customerPreloadRef.current.cancel?.();
    customerPreloadRef.current = {
      userId: null,
      cancel: null,
      secondaryScheduled: false,
    };

    clearDashboardCache();
    clearVehiclesCache();
    clearActiveBookingsCache();
    clearServiceHistoryCache();
    clearProfileCache();

    if (clearRole) {
      clearSessionRole();
    }
  };

  const clearGarageSession = ({ clearRole = true } = {}) => {
    // Remove legacy JWT storage left by older frontend versions.
    localStorage.removeItem("garage_token");
    localStorage.removeItem("garage");
    dispatch(clearGarageState());

    if (clearRole) {
      clearSessionRole();
    }
  };

  const clearSupportSession = ({ clearRole = true } = {}) => {
    localStorage.removeItem(SUPPORT_USER_KEY);
    dispatch(clearCustomerState());

    if (clearRole) {
      clearSessionRole({ support: true });
    }
  };

  const clearAllLocalSessions = () => {
    clearCustomerSession({ clearRole: false });
    clearGarageSession({ clearRole: false });
    queryClient.clear();
    clearSessionRole();
  };

  const preserveCartForHydratedContext = (nextVehicle, nextLocation) => {
    if (cartRef.current.length === 0) return;

    const nextContextKey = getCartPricingContextKey(
      nextVehicle,
      nextLocation,
    );

    if (nextContextKey !== cartContextKeyRef.current) {
      preservedHydrationContextKeysRef.current.add(nextContextKey);
    }
  };

  const syncVehicles = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];
    const selectedVehicle = getVehicleSelectionFromList(
      safeList,
      selectedVehicleRef.current,
    );

    preserveCartForHydratedContext(
      selectedVehicle,
      selectedLocationRef.current,
    );
    selectedVehicleRef.current = selectedVehicle;

    dispatch(setCustomerVehicles(safeList));

    localStorage.setItem("rov_vehicle", JSON.stringify(selectedVehicle));

    return safeList;
  };

  const syncUserData = (me) => {
    const normalizedUser = normalizeSessionAccount(me);
    if (!normalizedUser) return null;

    const nextVehicles = Array.isArray(normalizedUser.vehicles)
      ? normalizedUser.vehicles
      : [];
    const nextVehicle = getVehicleSelectionFromList(
      nextVehicles,
      selectedVehicleRef.current,
    );
    const syncedLocation = getLocationStateFromUser(
      normalizedUser,
      selectedLocationRef.current,
    );

    preserveCartForHydratedContext(nextVehicle, syncedLocation);
    selectedVehicleRef.current = nextVehicle;
    if (syncedLocation) {
      selectedLocationRef.current = syncedLocation;
    }

    dispatch(syncCustomerBundle(normalizedUser));

    if (syncedLocation) {
      dispatch(setCustomerLocation(syncedLocation));
    }

    // These values are UI caches only. Authentication still comes exclusively
    // from the HttpOnly cookie validated by /auth/me.
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    localStorage.setItem("rov_user", JSON.stringify(normalizedUser));

    syncVehicles(nextVehicles);

    return normalizedUser;
  };

  const syncAuthenticatedUser = (me) => {
    const normalizedUser = normalizeSessionAccount(me);
    if (!normalizedUser) return null;

    if (
      normalizedUser.accountType === "USER" &&
      normalizedUser.role === "CUSTOMER"
    ) {
      return syncUserData(normalizedUser);
    }

    dispatch(setCustomerUser(normalizedUser));

    if (normalizedUser.role === "CUSTOMER_SUPPORT") {
      localStorage.setItem(SUPPORT_USER_KEY, JSON.stringify(normalizedUser));
      return normalizedUser;
    }

    // Admin and intern accounts use the shared main-session cache, but should
    // not be treated as customer profile or vehicle data.
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    localStorage.setItem("rov_user", JSON.stringify(normalizedUser));

    return normalizedUser;
  };

  const customerScopeId = user?.role === "CUSTOMER" ? user.id : null;
  const dashboardQueryKey = queryKeys.customer.dashboard(customerScopeId);
  const vehiclesQueryKey = queryKeys.customer.vehicles(customerScopeId);
  const activeBookingsQueryKey = queryKeys.customer.activeBookings(customerScopeId);
  const serviceHistoryQueryKey = queryKeys.customer.serviceHistory(customerScopeId);
  const profileQueryKey = queryKeys.customer.profile(customerScopeId);
  const serviceCategoriesQueryKey = queryKeys.customer.serviceCategories({
    userId: customerScopeId,
    vehicleId: customerScopeId ? vehicle?.id : null,
    city: customerScopeId ? location?.city : null,
  });
  const vehicleMetaQueryKey = queryKeys.customer.vehicleMeta;

  const loadDashboardFromApi = async () => {
    const response = await api.get("/dashboard/customer");
    const data = response.data.data;

    if (data?.user) {
      syncUserData({
        ...data.user,
        vehicles: data.vehicles || data.user.vehicles || [],
      });
    }

    if (Array.isArray(data?.vehicles)) {
      syncVehicles(data.vehicles);
      queryClient.setQueryData(vehiclesQueryKey, data.vehicles);
    }

    return data;
  };

  const loadVehiclesFromApi = async () => {
    const response = await api.get("/vehicles");
    const data = response.data.data || [];
    syncVehicles(data);
    return data;
  };

  const loadActiveBookingsFromApi = async () => {
    const response = await api.get("/bookings", {
      params: {
        status:
          "PENDING_VERIFICATION,SEARCHING_GARAGE,GARAGE_ASSIGNED,CONFIRMED,IN_PROGRESS",
      },
    });
    return response.data.data || [];
  };

  const loadServiceHistoryFromApi = async () => {
    const response = await api.get("/bookings", {
      params: { status: "COMPLETED" },
    });
    return response.data.data || [];
  };

  const loadProfileFromApi = async () => {
    const response = await api.get("/customer/profile");
    const data = response.data.data;
    syncUserData(data);
    return data;
  };

  const loadServiceCategoriesFromApi = async () => {
    const params = customerScopeId
      ? {
          ...(vehicle?.id && { vehicleId: vehicle.id }),
          ...(location?.city && { city: location.city }),
        }
      : {};
    const response = await api.get("/services/categories", { params });
    return Array.isArray(response.data?.data) ? response.data.data : [];
  };

  const loadVehicleMetaFromApi = async () => {
    const response = await api.get("/vehicle-meta/brands");
    return response.data.data || [];
  };

  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: loadDashboardFromApi,
    enabled: false,
    staleTime: DASHBOARD_CACHE_TTL,
  });
  const vehiclesQuery = useQuery({
    queryKey: vehiclesQueryKey,
    queryFn: loadVehiclesFromApi,
    enabled: false,
    staleTime: VEHICLES_CACHE_TTL,
  });
  const activeBookingsQuery = useQuery({
    queryKey: activeBookingsQueryKey,
    queryFn: loadActiveBookingsFromApi,
    enabled: false,
    staleTime: ACTIVE_BOOKINGS_CACHE_TTL,
  });
  const serviceHistoryQuery = useQuery({
    queryKey: serviceHistoryQueryKey,
    queryFn: loadServiceHistoryFromApi,
    enabled: false,
    staleTime: SERVICE_HISTORY_CACHE_TTL,
  });
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: loadProfileFromApi,
    enabled: false,
    staleTime: PROFILE_CACHE_TTL,
  });
  const serviceCategoriesQuery = useQuery({
    queryKey: serviceCategoriesQueryKey,
    queryFn: loadServiceCategoriesFromApi,
    enabled: false,
    staleTime: SERVICES_CACHE_TTL,
  });
  const vehicleMetaQuery = useQuery({
    queryKey: vehicleMetaQueryKey,
    queryFn: loadVehicleMetaFromApi,
    enabled: false,
    staleTime: VEHICLE_META_CACHE_TTL,
  });

  const clearDashboardCache = () =>
    queryClient.removeQueries({ queryKey: queryKeys.customer.dashboard(customerScopeId) });
  const clearVehiclesCache = () =>
    queryClient.removeQueries({ queryKey: queryKeys.customer.vehicles(customerScopeId) });
  const clearActiveBookingsCache = () =>
    queryClient.removeQueries({ queryKey: queryKeys.customer.activeBookings(customerScopeId) });
  const clearServiceHistoryCache = () =>
    queryClient.removeQueries({ queryKey: queryKeys.customer.serviceHistory(customerScopeId) });
  const clearProfileCache = () =>
    queryClient.removeQueries({ queryKey: queryKeys.customer.profile(customerScopeId) });
  const clearServiceCategoriesCache = () =>
    queryClient.removeQueries({ queryKey: ["services", "categories"] });
  const clearVehicleMetaCache = () =>
    queryClient.removeQueries({ queryKey: vehicleMetaQueryKey });

  const saveVehiclesCache = (data) =>
    queryClient.setQueryData(vehiclesQueryKey, Array.isArray(data) ? data : []);

  const clearBookingCaches = () => {
    clearDashboardCache();
    clearActiveBookingsCache();
    clearServiceHistoryCache();
  };

  const login = (userData) => {
    if (!userData) {
      throw new Error("User data is required");
    }

    const normalizedUser = normalizeSessionAccount(userData);

    if (!isValidSessionIdentity(normalizedUser)) {
      throw new Error("Invalid authenticated account");
    }

    if (normalizedUser.role === "CUSTOMER_SUPPORT") {
      // Support has its own HttpOnly cookie and local cache. Keep any customer,
      // garage, admin, or intern session intact in the main Rovauto app.
      // Clean only support artifacts left by builds that used the shared cookie.
      clearLegacySupportStorage();
      clearSupportSession({ clearRole: false });
      setSessionRole(normalizedUser.role, normalizedUser.accountType);
      syncAuthenticatedUser(normalizedUser);
      setAuthLoading(false);
      return;
    }

    const preserveCustomerCart =
      normalizedUser.role === "CUSTOMER" && cart.length > 0;

    preserveCartContextChangeRef.current = preserveCustomerCart;
    clearCustomerSession({
      clearRole: false,
      preserveCart: preserveCustomerCart,
    });
    clearGarageSession({ clearRole: false });
    localStorage.removeItem("token");

    setSessionRole(
      normalizedUser.role,
      normalizedUser.accountType,
    );

    syncAuthenticatedUser(normalizedUser);
    setAuthLoading(false);

    clearDashboardCache();
    clearVehiclesCache();
    clearActiveBookingsCache();
    clearServiceHistoryCache();
    clearProfileCache();
  };

  const loginGarage = (garageData) => {
    if (!garageData) {
      throw new Error("Garage data is required");
    }

    // Remove stale customer/admin UI state before activating the garage portal.
    clearCustomerSession({ clearRole: false });
    localStorage.removeItem("garage_token");
    localStorage.setItem("garage", JSON.stringify(garageData));
    const role = garageData.role || garageData.sessionUser?.role || "GARAGE_OWNER";
    const accountType = garageData.accountType || garageData.sessionUser?.accountType || (role === "GARAGE_CONTROLLER" ? "GARAGE_CONTROLLER" : "USER");
    setSessionRole(role, accountType);
    if (garageData.sessionUser) syncAuthenticatedUser(garageData.sessionUser);
    dispatch(setGarage(garageData));
    setAuthLoading(false);
  };

  const fetchMe = async ({
    sync = true,
    portal = isSupportPortalPath() ? "support" : "main",
  } = {}) => {
    if (authRequestRef.current) {
      return authRequestRef.current;
    }

    let request;
    request = (async () => {
      try {
        const supportPortal = portal === "support";
        const response = await api.get(
          supportPortal ? "/auth/support/me" : "/auth/me",
          {
            skipSessionExpiryMessage: true,
            sessionScope: supportPortal ? "support" : "main",
          },
        );
        const me = normalizeSessionAccount(response.data?.data);

        if (!isValidSessionIdentity(me)) {
          throw new Error("Invalid current-user response");
        }

        setSessionRole(
          me.role,
          me.accountType,
        );

        if (
          sync &&
          !(
            me.accountType === "USER" &&
            me.role === "GARAGE_OWNER"
          )
        ) {
          syncAuthenticatedUser(me);
        }

        return me;
      } catch (err) {
        if (err.response?.status === 401) {
          if (portal === "support") {
            clearSupportSession();
          } else {
            clearAllLocalSessions();
          }
        }

        return null;
      }
    })().finally(() => {
      if (authRequestRef.current === request) {
        authRequestRef.current = null;
      }
    });

    authRequestRef.current = request;
    return request;
  };

  const refreshGarage = async (options = {}) => {
    const forceRefresh =
      typeof options === "object" && options !== null && options.force === true;

    if (garageRequestRef.current) {
      if (!forceRefresh) {
        return garageRequestRef.current;
      }

      await garageRequestRef.current.catch(() => null);
    }

    let request;
    request = (async () => {
      try {
        const garageData = await garageApi.getProfile();

        if (!garageData) {
          throw new Error("Invalid garage profile response");
        }

        localStorage.setItem("garage", JSON.stringify(garageData));
        const role = garageData.role || garageData.controller?.role || options.sessionUser?.role || "GARAGE_OWNER";
        const accountType = role === "GARAGE_CONTROLLER" ? "GARAGE_CONTROLLER" : "USER";
        setSessionRole(role, accountType);
        dispatch(setGarage(garageData));

        return garageData;
      } catch (err) {
        if (err.response?.status === 401) {
          clearAllLocalSessions();
        } else if (
          err.response?.status === 403 &&
          err.response?.data?.code === "GARAGE_PASSWORD_CHANGE_REQUIRED"
        ) {
          const pendingGarage = readJson("garage", null);

          if (pendingGarage?.mustChangePassword) {
            setSessionRole("GARAGE_OWNER", "USER");
            dispatch(setGarage(pendingGarage));
            return pendingGarage;
          }
        } else if (err.response?.status === 403) {
          // A valid non-garage session must not be destroyed just because an old
          // garage cache existed. Remove only the garage-side state.
          clearGarageSession({ clearRole: false });

          if (localStorage.getItem(SESSION_ROLE_KEY) === "GARAGE_OWNER") {
            clearSessionRole();
          }
        }

        return null;
      }
    })().finally(() => {
      if (garageRequestRef.current === request) {
        garageRequestRef.current = null;
      }
    });

    garageRequestRef.current = request;
    return request;
  };

  const logoutGarage = async () => {
    try {
      await disablePushNotifications({
        ignoreServerErrors: true,
        scope: "garage",
      });
    } catch {
      // Logging out must continue even if this browser has no push subscription.
    }

    try {
      await garageApi.logout();
    } catch {
      // Local cleanup still happens if the server session is already gone.
    }

    clearAllLocalSessions();
  };

  const logout = async () => {
    const supportSession =
      isSupportPortalPath() || user?.role === "CUSTOMER_SUPPORT";
    const pushScope = supportSession ? "support" : "user";

    try {
      await disablePushNotifications({
        ignoreServerErrors: true,
        scope: pushScope,
      });
    } catch {
      // Logging out must continue even if this browser has no push subscription.
    }

    try {
      await api.post(
        supportSession ? "/auth/support/logout" : "/auth/logout",
        undefined,
        { sessionScope: supportSession ? "support" : "main" },
      );
    } catch {
      // Local cleanup still happens if the server session is already gone.
    }

    if (supportSession) {
      clearSupportSession();
    } else {
      clearAllLocalSessions();
    }
  };

  const fetchDashboard = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: dashboardQueryKey,
      queryFn: loadDashboardFromApi,
      staleTime: force ? 0 : DASHBOARD_CACHE_TTL,
    });

  const fetchVehicles = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: vehiclesQueryKey,
      queryFn: loadVehiclesFromApi,
      staleTime: force ? 0 : VEHICLES_CACHE_TTL,
    });

  const fetchActiveBookings = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: activeBookingsQueryKey,
      queryFn: loadActiveBookingsFromApi,
      staleTime: force ? 0 : ACTIVE_BOOKINGS_CACHE_TTL,
    });

  const fetchServiceHistory = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: serviceHistoryQueryKey,
      queryFn: loadServiceHistoryFromApi,
      staleTime: force ? 0 : SERVICE_HISTORY_CACHE_TTL,
    });

  const fetchProfile = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: profileQueryKey,
      queryFn: loadProfileFromApi,
      staleTime: force ? 0 : PROFILE_CACHE_TTL,
    });

  const fetchServiceCategories = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: serviceCategoriesQueryKey,
      queryFn: loadServiceCategoriesFromApi,
      staleTime: force ? 0 : SERVICES_CACHE_TTL,
    });

  const fetchVehicleMeta = ({ force = false } = {}) =>
    queryClient.fetchQuery({
      queryKey: vehicleMetaQueryKey,
      queryFn: loadVehicleMetaFromApi,
      staleTime: force ? 0 : VEHICLE_META_CACHE_TTL,
    });

  const preloadCustomerData = ({
    force = false,
    userId = user?.id || null,
    includeSecondary = true,
  } = {}) => {
    const criticalRequest = fetchDashboard({ force }).catch(() => null);

    if (!includeSecondary || isConstrainedConnection()) {
      return criticalRequest;
    }

    const preloadState = customerPreloadRef.current;

    if (preloadState.userId !== userId) {
      preloadState.cancel?.();
      customerPreloadRef.current = {
        userId,
        cancel: null,
        secondaryScheduled: false,
      };
    }

    if (!customerPreloadRef.current.secondaryScheduled) {
      customerPreloadRef.current.secondaryScheduled = true;
      customerPreloadRef.current.cancel = scheduleIdleTask(() => {
        customerPreloadRef.current.cancel = null;

        Promise.allSettled([
          fetchActiveBookings(),
          fetchServiceHistory(),
          fetchVehicleMeta(),
        ]).catch(() => null);
      });
    }

    return criticalRequest;
  };

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const roleHint = getStoredSessionRole();

      // No local hint on public pages means the visitor is logged out. On
      // protected pages still verify /auth/me because the HttpOnly cookie can
      // survive while localStorage was cleared by the browser or another tab.
      if (!roleHint && !isProtectedPath()) {
        if (active) {
          setAuthLoading(false);
        }
        return;
      }

      // /auth/me is the single source of truth for the shared HttpOnly cookie.
      // Only after confirming GARAGE_OWNER do we request /garages/me.
      const supportPortal = isSupportPortalPath();
      const me = await fetchMe({
        sync: false,
        portal: supportPortal ? "support" : "main",
      });

      if (!me) {
        if (active) {
          setAuthLoading(false);
        }
        return;
      }

      if (supportPortal) {
        clearSupportSession({ clearRole: false });
        syncAuthenticatedUser(me);
      } else if (
        (me.accountType === "USER" && me.role === "GARAGE_OWNER") ||
        (me.accountType === "GARAGE_CONTROLLER" && me.role === "GARAGE_CONTROLLER")
      ) {
        clearCustomerSession({ clearRole: false });

        if (me.mustChangePassword) {
          const pendingGarage = {
            ownerName: me.name,
            name: me.name || "Garage",
            email: me.email || "",
            phone: me.phone || "",
            role: me.role,
            mustChangePassword: true,
            isFirstLogin: true,
          };

          localStorage.setItem("garage", JSON.stringify(pendingGarage));
          setSessionRole("GARAGE_OWNER", "USER");
          dispatch(setGarage(pendingGarage));
        } else {
          await refreshGarage({ sessionUser: me });
        }
      } else {
        // A customer can refresh or revisit checkout while the HttpOnly
        // session cookie is still valid. Preserve the session-backed cart
        // until the restored profile has rehydrated its pricing context.
        const preserveCustomerCart =
          me.accountType === "USER" &&
          me.role === "CUSTOMER" &&
          cart.length > 0;

        preserveCartContextChangeRef.current = preserveCustomerCart;
        clearCustomerSession({
          clearRole: false,
          preserveCart: preserveCustomerCart,
        });
        clearGarageSession({ clearRole: false });
        syncAuthenticatedUser(me);
      }

      if (active) {
        setAuthLoading(false);
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || user?.role !== "CUSTOMER") return;

    preloadCustomerData({ userId: user.id });
  }, [authLoading, user?.id, user?.role]);

  useEffect(() => {
    if (authLoading) return;

    const isCustomerSupport = user?.role === "CUSTOMER_SUPPORT";
    const hasPushEligibleSession =
      user?.role === "CUSTOMER" ||
      Boolean(garageUser && !garageUser.mustChangePassword && !garageUser.isControllerSession) ||
      isCustomerSupport;

    if (!hasPushEligibleSession) return;

    syncExistingPushSubscription({
      scope: isCustomerSupport
        ? "support"
        : garageUser
          ? "garage"
          : "user",
    }).catch((error) => {
      console.warn("Unable to sync Web Push subscription:", error);
    });
  }, [authLoading, user?.id, user?.role, garageUser?.id]);

  useEffect(() => {
    let lastRefreshAt = Date.now();

    const refreshRestoredSession = () => {
      const now = Date.now();

      if (now - lastRefreshAt < 30000) {
        return;
      }

      lastRefreshAt = now;

      if (user) {
        fetchMe({
          portal:
            user.role === "CUSTOMER_SUPPORT" || isSupportPortalPath()
              ? "support"
              : "main",
        });
        return;
      }

      if (garageUser && !garageUser.mustChangePassword) {
        refreshGarage();
      }
    };

    const onPageShow = (event) => {
      if (event.persisted) {
        refreshRestoredSession();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshRestoredSession();
      }
    };

    const onOnline = () => {
      refreshRestoredSession();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, [user, garageUser]);

  useEffect(() => {
    const handleSessionExpired = (event) => {
      if (event.detail?.scope === "support") {
        clearSupportSession();
      } else {
        clearAllLocalSessions();
      }
      setAuthLoading(false);
    };

    window.addEventListener(
      "rovauto:session-expired",
      handleSessionExpired,
    );

    return () => {
      window.removeEventListener(
        "rovauto:session-expired",
        handleSessionExpired,
      );
    };
  }, []);

  useEffect(() => {
    // Wait for cookie-session restoration to finish. During hydration the
    // cached address can be replaced by the authoritative profile location;
    // that must not erase a valid same-city cart.
    if (authLoading) return;

    const nextContextKey = getCartPricingContextKey(vehicle, location);

    const isHydratedContextChange =
      preservedHydrationContextKeysRef.current.has(nextContextKey);

    if (cartContextKey && cartContextKey !== nextContextKey && cart.length > 0) {
      if (
        preserveCartContextChangeRef.current ||
        isHydratedContextChange
      ) {
        setCart((current) => {
          const nextCart = current.map((item) => ({
            ...item,
            pricingContextKey: nextContextKey,
          }));
          cartRef.current = nextCart;
          return nextCart;
        });
        preserveCartContextChangeRef.current = false;
        preservedHydrationContextKeysRef.current.delete(nextContextKey);
      } else {
        setCart([]);
        cartRef.current = [];
      }
    }

    if (cartContextKey !== nextContextKey) {
      setCartContextKey(nextContextKey);
      cartContextKeyRef.current = nextContextKey;
    } else {
      preservedHydrationContextKeysRef.current.delete(nextContextKey);

      if (preserveCartContextChangeRef.current) {
        preserveCartContextChangeRef.current = false;
      }
    }
  }, [
    cart.length,
    cartContextKey,
    authLoading,
    vehicle?.id,
    location?.city,
  ]);

  useEffect(() => {
    if (cart.length === 0) {
      preservedHydrationContextKeysRef.current.clear();
      removeSessionCache(CART_CACHE_KEY);
    } else {
      setSessionCache(CART_CACHE_KEY, JSON.stringify(cart));
    }

    if (cartContextKey) {
      setSessionCache(CART_CONTEXT_CACHE_KEY, cartContextKey);
    } else {
      removeSessionCache(CART_CONTEXT_CACHE_KEY);
    }
  }, [cart, cartContextKey]);

  useEffect(() => {
    if (!user) return;

    if (user.role === "CUSTOMER_SUPPORT") {
      localStorage.setItem(SUPPORT_USER_KEY, JSON.stringify(user));
      return;
    }

    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("rov_user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (garageUser) {
      localStorage.setItem("garage", JSON.stringify(garageUser));
    }
  }, [garageUser]);

  useEffect(() => {
    if (user?.role === "CUSTOMER") {
      localStorage.setItem("rov_vehicle", JSON.stringify(vehicle));
    }
  }, [user?.role, vehicle]);

  useEffect(() => {
    if (user?.role === "CUSTOMER") {
      localStorage.setItem("rov_location", JSON.stringify(location));
    }
  }, [user?.role, location]);

  const setUser = (value) => {
    const nextUser = typeof value === "function" ? value(user) : value;
    dispatch(setCustomerUser(normalizeSessionAccount(nextUser)));
  };

  const setVehicle = (value) => {
    const nextVehicle = typeof value === "function" ? value(vehicle) : value;
    // A direct user choice is intentional and must not consume a stale
    // background-hydration exemption.
    preservedHydrationContextKeysRef.current.clear();
    selectedVehicleRef.current = nextVehicle;
    dispatch(setCustomerVehicle(nextVehicle));
  };

  const setVehicles = (value) => {
    const nextVehicles =
      typeof value === "function" ? value(vehicles) : value;
    const nextVehicle = getVehicleSelectionFromList(
      nextVehicles,
      selectedVehicleRef.current,
    );

    selectedVehicleRef.current = nextVehicle;
    dispatch(setCustomerVehicles(nextVehicles));
  };

  const setLocation = (value) => {
    const nextLocation =
      typeof value === "function" ? value(location) : value;
    // A direct user choice is intentional and must not consume a stale
    // background-hydration exemption.
    preservedHydrationContextKeysRef.current.clear();
    selectedLocationRef.current = nextLocation;
    dispatch(setCustomerLocation(nextLocation));
  };

  const addVehicle = (newVehicleData) => {
    const currentVehicles = Array.isArray(vehicles) ? vehicles : [];

    const newVehicle = {
      ...newVehicleData,
      id: newVehicleData.id || `local-${Date.now()}`,
      isDefault: currentVehicles.length === 0,
    };

    const updatedVehicles = [...currentVehicles, newVehicle];

    syncVehicles(updatedVehicles);
    clearDashboardCache();
    clearVehiclesCache();

    return newVehicle;
  };

  const updateVehiclesLocally = (list = []) => {
    syncVehicles(list);
    saveVehiclesCache(list, Date.now());
    clearDashboardCache();
  };

  const addToCart = (service) => {
    const nextContextKey = getCartPricingContextKey(vehicle, location);
    const contextSafeCart = cartContextKey === nextContextKey ? cart : [];
    const exists = contextSafeCart.some((item) => item.id === service.id);

    if (exists) {
      return { added: false, alreadyInCart: true };
    }

    const nextCart = [
      ...contextSafeCart,
      {
        ...service,
        fulfillmentType: normalizeServiceFulfillmentMode(
          service?.fulfillmentType,
        ),
        pricingContextKey: nextContextKey,
      },
    ];

    setCartContextKey(nextContextKey);
    cartContextKeyRef.current = nextContextKey;
    setCart(nextCart);
    cartRef.current = nextCart;

    return { added: true };
  };

  const removeFromCart = (id) => {
    setCart((current) => {
      const nextCart = current.filter((item) => item.id !== id);
      cartRef.current = nextCart;
      return nextCart;
    });
  };

  const clearCart = () => {
    const nextContextKey = getCartPricingContextKey(vehicle, location);
    setCart([]);
    cartRef.current = [];
    setCartContextKey(nextContextKey);
    cartContextKeyRef.current = nextContextKey;
    preservedHydrationContextKeysRef.current.clear();
  };

  const value = {
    user,
    garage: garageUser,
    token: user ? "cookie-session" : "",
    garageToken: garageUser ? "cookie-session" : "",
    vehicle,
    vehicles,
    location,
    cart,
    authLoading,
    isAuthenticated: Boolean(user),
    isGarageAuthenticated: Boolean(garageUser),

    dashboardCache: dashboardQuery.data ?? null,
    dashboardFetchedAt: dashboardQuery.dataUpdatedAt || null,
    serviceCategoriesCache: serviceCategoriesQuery.data ?? null,
    serviceCategoriesFetchedAt: serviceCategoriesQuery.dataUpdatedAt || null,
    vehicleMetaCache: vehicleMetaQuery.data ?? null,
    vehicleMetaFetchedAt: vehicleMetaQuery.dataUpdatedAt || null,
    vehiclesCache: vehiclesQuery.data ?? null,
    vehiclesFetchedAt: vehiclesQuery.dataUpdatedAt || null,
    activeBookingsCache: activeBookingsQuery.data ?? null,
    activeBookingsFetchedAt: activeBookingsQuery.dataUpdatedAt || null,
    serviceHistoryCache: serviceHistoryQuery.data ?? null,
    serviceHistoryFetchedAt: serviceHistoryQuery.dataUpdatedAt || null,
    profileCache: profileQuery.data ?? null,
    profileFetchedAt: profileQuery.dataUpdatedAt || null,

    setUser,
    setGarage: (value) => {
      const nextGarage = typeof value === "function" ? value(garageUser) : value;
      dispatch(setGarage(nextGarage));
    },
    setVehicle,
    setVehicles,
    setCart,
    setLocation,

    login,
    logout,
    loginGarage,
    logoutGarage,
    refreshGarage,
    fetchMe,
    fetchDashboard,
    fetchVehicles,
    fetchActiveBookings,
    fetchServiceHistory,
    fetchProfile,
    fetchServiceCategories,
    fetchVehicleMeta,
    preloadCustomerData,

    clearDashboardCache,
    clearServiceCategoriesCache,
    clearVehicleMetaCache,
    clearVehiclesCache,
    clearActiveBookingsCache,
    clearServiceHistoryCache,
    clearProfileCache,
    clearBookingCaches,

    addVehicle,
    updateVehiclesLocally,
    addToCart,
    removeFromCart,
    clearCart,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => {
  const value = useContext(AppCtx);

  if (!value) {
    throw new Error("useApp must be used within AppProvider");
  }

  return value;
};
