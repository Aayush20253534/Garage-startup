import { createContext, useContext, useEffect, useRef, useState } from "react";
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

const AppCtx = createContext(null);

const DASHBOARD_CACHE_TTL = 5 * 60 * 1000;
const SERVICES_CACHE_TTL = 30 * 60 * 1000;
const VEHICLE_META_CACHE_TTL = 24 * 60 * 60 * 1000;
const VEHICLES_CACHE_TTL = 5 * 60 * 1000;
const ACTIVE_BOOKINGS_CACHE_TTL = 60 * 1000;
const SERVICE_HISTORY_CACHE_TTL = 5 * 60 * 1000;
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

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
  "ADMIN",
  "INTERN",
  "CUSTOMER_SUPPORT",
]);

const ROLE_ACCOUNT_TYPES = {
  CUSTOMER: "USER",
  GARAGE_OWNER: "USER",
  ADMIN: "STAFF",
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

const readNumber = (key, fallback = null) => {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const readSessionJson = (key, fallback = null) => {
  try {
    const value = sessionStorage.getItem(key) || localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readSessionNumber = (key, fallback = null) => {
  const value = Number(sessionStorage.getItem(key) || localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

const getLocationIdentity = (value) => {
  if (!value) return null;

  return [
    value.id,
    value.placeId,
    value.city,
    value.latitude,
    value.longitude,
    value.formattedAddress || value.fullAddress || value.address,
  ]
    .filter((item) => item !== undefined && item !== null && item !== "")
    .join("|") || null;
};

const getCartPricingContextKey = (selectedVehicle, selectedLocation) =>
  JSON.stringify({
    vehicleId: selectedVehicle?.id || null,
    location: getLocationIdentity(selectedLocation),
  });


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
    setSessionRole("GARAGE_OWNER", "USER");
    return "GARAGE_OWNER";
  }

  if (
    pathname.startsWith("/admin") &&
    isValidSessionIdentity(cachedUser) &&
    cachedUser.role === "ADMIN"
  ) {
    setSessionRole(cachedUser.role, cachedUser.accountType);
    return "ADMIN";
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
    setSessionRole("GARAGE_OWNER", "USER");
    return "GARAGE_OWNER";
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
    return pathname !== "/admin/login";
  }

  if (pathname === "/intern" || pathname.startsWith("/intern/")) {
    return pathname !== "/intern/login";
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

  const { user, vehicle, vehicles, location } =
    useSelector(selectCustomerState);
  const { garage: garageUser } = useSelector(selectGarageState);

  const [cart, setCart] = useState([]);
  const [cartContextKey, setCartContextKey] = useState(() =>
    getCartPricingContextKey(vehicle, location),
  );
  const [authLoading, setAuthLoading] = useState(true);

  // Prevent duplicate session/profile requests when multiple components mount
  // together or the tab becomes visible repeatedly.
  const authRequestRef = useRef(null);
  const garageRequestRef = useRef(null);
  const profileRequestRef = useRef(null);

  const [dashboardCache, setDashboardCache] = useState(() =>
    readSessionJson("rov_dashboard", null),
  );
  const [dashboardFetchedAt, setDashboardFetchedAt] = useState(() =>
    readSessionNumber("rov_dashboard_time", null),
  );

  const [serviceCategoriesCache, setServiceCategoriesCache] = useState(() =>
    readJson("rov_service_categories", null),
  );
  const [serviceCategoriesFetchedAt, setServiceCategoriesFetchedAt] = useState(
    () => readNumber("rov_service_categories_time", null),
  );

  const [vehicleMetaCache, setVehicleMetaCache] = useState(() =>
    readJson("rov_vehicle_meta", null),
  );
  const [vehicleMetaFetchedAt, setVehicleMetaFetchedAt] = useState(() =>
    readNumber("rov_vehicle_meta_time", null),
  );

  const [vehiclesCache, setVehiclesCache] = useState(() =>
    readSessionJson("rov_vehicles_cache", null),
  );
  const [vehiclesFetchedAt, setVehiclesFetchedAt] = useState(() =>
    readSessionNumber("rov_vehicles_cache_time", null),
  );

  const [activeBookingsCache, setActiveBookingsCache] = useState(() =>
    readSessionJson("rov_active_bookings", null),
  );
  const [activeBookingsFetchedAt, setActiveBookingsFetchedAt] = useState(() =>
    readSessionNumber("rov_active_bookings_time", null),
  );

  const [serviceHistoryCache, setServiceHistoryCache] = useState(() =>
    readSessionJson("rov_service_history", null),
  );
  const [serviceHistoryFetchedAt, setServiceHistoryFetchedAt] = useState(() =>
    readSessionNumber("rov_service_history_time", null),
  );

  const [profileCache, setProfileCache] = useState(() =>
    readSessionJson("rov_profile", null),
  );
  const [profileFetchedAt, setProfileFetchedAt] = useState(() =>
    readSessionNumber("rov_profile_time", null),
  );

  const clearDashboardCache = () => {
    setDashboardCache(null);
    setDashboardFetchedAt(null);
    removeSessionCache("rov_dashboard");
    removeSessionCache("rov_dashboard_time");
  };

  const saveDashboardCache = (data, fetchedAt) => {
    setDashboardCache(data);
    setDashboardFetchedAt(fetchedAt);
    setSessionCache("rov_dashboard", JSON.stringify(data));
    setSessionCache("rov_dashboard_time", String(fetchedAt));
  };

  const clearServiceCategoriesCache = () => {
    setServiceCategoriesCache(null);
    setServiceCategoriesFetchedAt(null);
    localStorage.removeItem("rov_service_categories");
    localStorage.removeItem("rov_service_categories_time");
  };

  const saveServiceCategoriesCache = (data, fetchedAt) => {
    setServiceCategoriesCache(data);
    setServiceCategoriesFetchedAt(fetchedAt);
    localStorage.setItem("rov_service_categories", JSON.stringify(data));
    localStorage.setItem("rov_service_categories_time", String(fetchedAt));
  };

  const clearVehicleMetaCache = () => {
    setVehicleMetaCache(null);
    setVehicleMetaFetchedAt(null);
    localStorage.removeItem("rov_vehicle_meta");
    localStorage.removeItem("rov_vehicle_meta_time");
  };

  const saveVehicleMetaCache = (data, fetchedAt) => {
    setVehicleMetaCache(data);
    setVehicleMetaFetchedAt(fetchedAt);
    localStorage.setItem("rov_vehicle_meta", JSON.stringify(data));
    localStorage.setItem("rov_vehicle_meta_time", String(fetchedAt));
  };

  const clearVehiclesCache = () => {
    setVehiclesCache(null);
    setVehiclesFetchedAt(null);
    removeSessionCache("rov_vehicles_cache");
    removeSessionCache("rov_vehicles_cache_time");
  };

  const saveVehiclesCache = (data, fetchedAt) => {
    setVehiclesCache(data);
    setVehiclesFetchedAt(fetchedAt);
    setSessionCache("rov_vehicles_cache", JSON.stringify(data));
    setSessionCache("rov_vehicles_cache_time", String(fetchedAt));
  };

  const clearActiveBookingsCache = () => {
    setActiveBookingsCache(null);
    setActiveBookingsFetchedAt(null);
    removeSessionCache("rov_active_bookings");
    removeSessionCache("rov_active_bookings_time");
  };

  const saveActiveBookingsCache = (data, fetchedAt) => {
    setActiveBookingsCache(data);
    setActiveBookingsFetchedAt(fetchedAt);
    setSessionCache("rov_active_bookings", JSON.stringify(data));
    setSessionCache("rov_active_bookings_time", String(fetchedAt));
  };

  const clearServiceHistoryCache = () => {
    setServiceHistoryCache(null);
    setServiceHistoryFetchedAt(null);
    removeSessionCache("rov_service_history");
    removeSessionCache("rov_service_history_time");
  };

  const saveServiceHistoryCache = (data, fetchedAt) => {
    setServiceHistoryCache(data);
    setServiceHistoryFetchedAt(fetchedAt);
    setSessionCache("rov_service_history", JSON.stringify(data));
    setSessionCache("rov_service_history_time", String(fetchedAt));
  };

  const clearProfileCache = () => {
    setProfileCache(null);
    setProfileFetchedAt(null);
    removeSessionCache("rov_profile");
    removeSessionCache("rov_profile_time");
  };

  const saveProfileCache = (data, fetchedAt) => {
    setProfileCache(data);
    setProfileFetchedAt(fetchedAt);
    setSessionCache("rov_profile", JSON.stringify(data));
    setSessionCache("rov_profile_time", String(fetchedAt));
  };

  const clearBookingCaches = () => {
    clearDashboardCache();
    clearActiveBookingsCache();
    clearServiceHistoryCache();
  };

  const clearCustomerSession = ({ clearRole = true } = {}) => {
    // Remove legacy JWT storage left by older frontend versions.
    localStorage.removeItem("token");

    localStorage.removeItem("user");
    localStorage.removeItem("rov_user");
    localStorage.removeItem("rov_location");
    localStorage.removeItem("rov_vehicle");
    localStorage.removeItem("rov_vehicles");

    dispatch(clearCustomerState());
    setCart([]);

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
    clearSessionRole();
  };

  const syncVehicles = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];

    const defaultVehicle =
      safeList.find((item) => item.isDefault) || safeList[0] || null;

    dispatch(setCustomerVehicles(safeList));

    localStorage.setItem("rov_vehicles", JSON.stringify(safeList));
    localStorage.setItem("rov_vehicle", JSON.stringify(defaultVehicle));

    return safeList;
  };

  const syncUserData = (me) => {
    const normalizedUser = normalizeSessionAccount(me);
    if (!normalizedUser) return null;

    dispatch(syncCustomerBundle(normalizedUser));

    const syncedLocation = getLocationStateFromUser(normalizedUser, location);
    if (syncedLocation) {
      dispatch(setCustomerLocation(syncedLocation));
    }

    // These values are UI caches only. Authentication still comes exclusively
    // from the HttpOnly cookie validated by /auth/me.
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    localStorage.setItem("rov_user", JSON.stringify(normalizedUser));

    syncVehicles(normalizedUser.vehicles || []);

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

    clearCustomerSession({ clearRole: false });
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
    setSessionRole("GARAGE_OWNER", "USER");
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
        setSessionRole("GARAGE_OWNER", "USER");
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

  const fetchDashboard = async ({ force = false } = {}) => {
    const now = Date.now();

    if (
      !force &&
      dashboardCache &&
      dashboardFetchedAt &&
      now - dashboardFetchedAt < DASHBOARD_CACHE_TTL
    ) {
      return dashboardCache;
    }

    const response = await api.get("/dashboard/customer");
    const data = response.data.data;
    const fetchedAt = Date.now();

    saveDashboardCache(data, fetchedAt);

    if (data.user) {
      syncUserData({
        ...data.user,
        vehicles: data.vehicles || data.user.vehicles || [],
      });
    }

    if (data.vehicles) {
      syncVehicles(data.vehicles);
      saveVehiclesCache(data.vehicles, fetchedAt);
    }

    return data;
  };

  const fetchVehicles = async ({ force = false } = {}) => {
    const now = Date.now();

    if (
      !force &&
      vehiclesCache &&
      vehiclesFetchedAt &&
      now - vehiclesFetchedAt < VEHICLES_CACHE_TTL
    ) {
      syncVehicles(vehiclesCache);
      return vehiclesCache;
    }

    const response = await api.get("/vehicles");
    const data = response.data.data || [];
    const fetchedAt = Date.now();

    saveVehiclesCache(data, fetchedAt);
    syncVehicles(data);

    return data;
  };

  const fetchActiveBookings = async ({ force = false } = {}) => {
    const now = Date.now();

    if (
      !force &&
      activeBookingsCache &&
      activeBookingsFetchedAt &&
      now - activeBookingsFetchedAt < ACTIVE_BOOKINGS_CACHE_TTL
    ) {
      return activeBookingsCache;
    }

    const response = await api.get("/bookings", {
      params: {
        status:
          "SEARCHING_GARAGE,GARAGE_ASSIGNED,CONFIRMED,IN_PROGRESS",
      },
    });

    const data = response.data.data || [];
    const fetchedAt = Date.now();

    saveActiveBookingsCache(data, fetchedAt);

    return data;
  };

  const fetchServiceHistory = async ({ force = false } = {}) => {
    const now = Date.now();

    if (
      !force &&
      serviceHistoryCache &&
      serviceHistoryFetchedAt &&
      now - serviceHistoryFetchedAt < SERVICE_HISTORY_CACHE_TTL
    ) {
      return serviceHistoryCache;
    }

    const response = await api.get("/bookings", {
      params: {
        status: "COMPLETED",
      },
    });

    const data = response.data.data || [];
    const fetchedAt = Date.now();

    saveServiceHistoryCache(data, fetchedAt);

    return data;
  };

  const fetchProfile = async ({ force = false } = {}) => {
    const now = Date.now();

    if (
      !force &&
      profileCache &&
      profileFetchedAt &&
      now - profileFetchedAt < PROFILE_CACHE_TTL
    ) {
      return profileCache;
    }

    if (profileRequestRef.current) {
      return profileRequestRef.current;
    }

    let request;
    request = (async () => {
      const response = await api.get("/customer/profile");
      const data = response.data.data;
      const fetchedAt = Date.now();

      saveProfileCache(data, fetchedAt);
      syncUserData(data);

      return data;
    })().finally(() => {
      if (profileRequestRef.current === request) {
        profileRequestRef.current = null;
      }
    });

    profileRequestRef.current = request;
    return request;
  };

  const fetchServiceCategories = async ({ force = false } = {}) => {
    const now = Date.now();
    const usePublicCache = !user;

    const params = user
      ? {
          ...(vehicle?.id && { vehicleId: vehicle.id }),
          ...(location?.city && { city: location.city }),
        }
      : {};

    if (
      usePublicCache &&
      !force &&
      serviceCategoriesCache &&
      serviceCategoriesFetchedAt &&
      now - serviceCategoriesFetchedAt < SERVICES_CACHE_TTL
    ) {
      return serviceCategoriesCache;
    }

    const response = await api.get("/services/categories", { params });
    const data = response.data.data || [];
    const fetchedAt = Date.now();

    if (usePublicCache) {
      saveServiceCategoriesCache(data, fetchedAt);
    }

    return data;
  };

  const fetchVehicleMeta = async ({ force = false } = {}) => {
    const now = Date.now();

    if (
      !force &&
      vehicleMetaCache &&
      vehicleMetaFetchedAt &&
      now - vehicleMetaFetchedAt < VEHICLE_META_CACHE_TTL
    ) {
      return vehicleMetaCache;
    }

    const response = await api.get("/vehicle-meta/brands");
    const data = response.data.data || [];
    const fetchedAt = Date.now();

    saveVehicleMetaCache(data, fetchedAt);

    return data;
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
      } else if (me.accountType === "USER" && me.role === "GARAGE_OWNER") {
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
          await refreshGarage();
        }
      } else {
        clearCustomerSession({ clearRole: false });
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
    if (authLoading) return;

    const isCustomerSupport = user?.role === "CUSTOMER_SUPPORT";
    const hasPushEligibleSession =
      user?.role === "CUSTOMER" ||
      Boolean(garageUser && !garageUser.mustChangePassword) ||
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
    const nextContextKey = getCartPricingContextKey(vehicle, location);

    if (cartContextKey && cartContextKey !== nextContextKey && cart.length > 0) {
      setCart([]);
    }

    if (cartContextKey !== nextContextKey) {
      setCartContextKey(nextContextKey);
    }
  }, [
    cart.length,
    cartContextKey,
    vehicle?.id,
    location?.id,
    location?.placeId,
    location?.city,
    location?.latitude,
    location?.longitude,
    location?.formattedAddress,
    location?.fullAddress,
    location?.address,
  ]);

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
      localStorage.setItem("rov_vehicles", JSON.stringify(vehicles));
    }
  }, [user?.role, vehicles]);

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
    dispatch(setCustomerVehicle(nextVehicle));
  };

  const setVehicles = (value) => {
    const nextVehicles =
      typeof value === "function" ? value(vehicles) : value;
    dispatch(setCustomerVehicles(nextVehicles));
  };

  const setLocation = (value) => {
    const nextLocation =
      typeof value === "function" ? value(location) : value;
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

    setCartContextKey(nextContextKey);
    setCart((current) => {
      const contextSafeCart =
        cartContextKey === nextContextKey ? current : [];
      const exists = contextSafeCart.find((item) => item.id === service.id);

      return exists
        ? contextSafeCart
        : [
            ...contextSafeCart,
            {
              ...service,
              pricingContextKey: nextContextKey,
            },
          ];
    });
  };

  const removeFromCart = (id) => {
    setCart((current) => current.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCartContextKey(getCartPricingContextKey(vehicle, location));
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

    dashboardCache,
    dashboardFetchedAt,
    serviceCategoriesCache,
    serviceCategoriesFetchedAt,
    vehicleMetaCache,
    vehicleMetaFetchedAt,
    vehiclesCache,
    vehiclesFetchedAt,
    activeBookingsCache,
    activeBookingsFetchedAt,
    serviceHistoryCache,
    serviceHistoryFetchedAt,
    profileCache,
    profileFetchedAt,

    setUser,
    setVehicle,
    setVehicles,
    setCart,
    setLocation,

    setDashboardCache,
    setDashboardFetchedAt,
    setServiceCategoriesCache,
    setServiceCategoriesFetchedAt,
    setVehicleMetaCache,
    setVehicleMetaFetchedAt,
    setVehiclesCache,
    setVehiclesFetchedAt,
    setActiveBookingsCache,
    setActiveBookingsFetchedAt,
    setServiceHistoryCache,
    setServiceHistoryFetchedAt,
    setProfileCache,
    setProfileFetchedAt,

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
