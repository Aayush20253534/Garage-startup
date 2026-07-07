import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "@/api/axios";
import { garageApi } from "@/api/garage";
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

const VALID_SESSION_ROLES = new Set([
  "CUSTOMER",
  "GARAGE_OWNER",
  "ADMIN",
  "INTERN",
]);

const ROLE_ACCOUNT_TYPES = {
  CUSTOMER: "USER",
  GARAGE_OWNER: "USER",
  ADMIN: "STAFF",
  INTERN: "STAFF",
};

const isValidSessionIdentity = (account) =>
  Boolean(
    account &&
      VALID_SESSION_ROLES.has(account.role) &&
      ROLE_ACCOUNT_TYPES[account.role] === account.accountType,
  );

const setSessionRole = (role, accountType) => {
  if (ROLE_ACCOUNT_TYPES[role] !== accountType) {
    return false;
  }

  localStorage.setItem(SESSION_ROLE_KEY, role);
  localStorage.setItem(
    SESSION_ACCOUNT_TYPE_KEY,
    accountType,
  );

  return true;
};

const clearSessionRole = () => {
  localStorage.removeItem(SESSION_ROLE_KEY);
  localStorage.removeItem(SESSION_ACCOUNT_TYPE_KEY);
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

const getStoredSessionRole = () => {
  const explicitRole = localStorage.getItem(SESSION_ROLE_KEY);
  const explicitAccountType = localStorage.getItem(
    SESSION_ACCOUNT_TYPE_KEY,
  );

  if (
    ROLE_ACCOUNT_TYPES[explicitRole] === explicitAccountType
  ) {
    return explicitRole;
  }

  const pathname = window.location.pathname;
  const cachedUser =
    readJson("rov_user", null) ||
    readJson("user", null);
  const cachedGarage = readJson("garage", null);

  if (pathname.startsWith("/garage") && cachedGarage) {
    return "GARAGE_OWNER";
  }

  if (
    pathname.startsWith("/admin") &&
    isValidSessionIdentity(cachedUser) &&
    cachedUser.role === "ADMIN"
  ) {
    return "ADMIN";
  }

  if (
    pathname.startsWith("/intern") &&
    isValidSessionIdentity(cachedUser) &&
    cachedUser.role === "INTERN"
  ) {
    return "INTERN";
  }

  if (isValidSessionIdentity(cachedUser)) {
    return cachedUser.role;
  }

  if (cachedGarage) {
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
  const [authLoading, setAuthLoading] = useState(true);

  // Prevent duplicate session/profile requests when multiple components mount
  // together or the tab becomes visible repeatedly.
  const authRequestRef = useRef(null);
  const garageRequestRef = useRef(null);
  const profileRequestRef = useRef(null);

  const [dashboardCache, setDashboardCache] = useState(() =>
    readJson("rov_dashboard", null),
  );
  const [dashboardFetchedAt, setDashboardFetchedAt] = useState(() =>
    readNumber("rov_dashboard_time", null),
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
    readJson("rov_vehicles_cache", null),
  );
  const [vehiclesFetchedAt, setVehiclesFetchedAt] = useState(() =>
    readNumber("rov_vehicles_cache_time", null),
  );

  const [activeBookingsCache, setActiveBookingsCache] = useState(() =>
    readJson("rov_active_bookings", null),
  );
  const [activeBookingsFetchedAt, setActiveBookingsFetchedAt] = useState(() =>
    readNumber("rov_active_bookings_time", null),
  );

  const [serviceHistoryCache, setServiceHistoryCache] = useState(() =>
    readJson("rov_service_history", null),
  );
  const [serviceHistoryFetchedAt, setServiceHistoryFetchedAt] = useState(() =>
    readNumber("rov_service_history_time", null),
  );

  const [profileCache, setProfileCache] = useState(() =>
    readJson("rov_profile", null),
  );
  const [profileFetchedAt, setProfileFetchedAt] = useState(() =>
    readNumber("rov_profile_time", null),
  );

  const clearDashboardCache = () => {
    setDashboardCache(null);
    setDashboardFetchedAt(null);
    localStorage.removeItem("rov_dashboard");
    localStorage.removeItem("rov_dashboard_time");
  };

  const saveDashboardCache = (data, fetchedAt) => {
    setDashboardCache(data);
    setDashboardFetchedAt(fetchedAt);
    localStorage.setItem("rov_dashboard", JSON.stringify(data));
    localStorage.setItem("rov_dashboard_time", String(fetchedAt));
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
    localStorage.removeItem("rov_vehicles_cache");
    localStorage.removeItem("rov_vehicles_cache_time");
  };

  const saveVehiclesCache = (data, fetchedAt) => {
    setVehiclesCache(data);
    setVehiclesFetchedAt(fetchedAt);
    localStorage.setItem("rov_vehicles_cache", JSON.stringify(data));
    localStorage.setItem("rov_vehicles_cache_time", String(fetchedAt));
  };

  const clearActiveBookingsCache = () => {
    setActiveBookingsCache(null);
    setActiveBookingsFetchedAt(null);
    localStorage.removeItem("rov_active_bookings");
    localStorage.removeItem("rov_active_bookings_time");
  };

  const saveActiveBookingsCache = (data, fetchedAt) => {
    setActiveBookingsCache(data);
    setActiveBookingsFetchedAt(fetchedAt);
    localStorage.setItem("rov_active_bookings", JSON.stringify(data));
    localStorage.setItem("rov_active_bookings_time", String(fetchedAt));
  };

  const clearServiceHistoryCache = () => {
    setServiceHistoryCache(null);
    setServiceHistoryFetchedAt(null);
    localStorage.removeItem("rov_service_history");
    localStorage.removeItem("rov_service_history_time");
  };

  const saveServiceHistoryCache = (data, fetchedAt) => {
    setServiceHistoryCache(data);
    setServiceHistoryFetchedAt(fetchedAt);
    localStorage.setItem("rov_service_history", JSON.stringify(data));
    localStorage.setItem("rov_service_history_time", String(fetchedAt));
  };

  const clearProfileCache = () => {
    setProfileCache(null);
    setProfileFetchedAt(null);
    localStorage.removeItem("rov_profile");
    localStorage.removeItem("rov_profile_time");
  };

  const saveProfileCache = (data, fetchedAt) => {
    setProfileCache(data);
    setProfileFetchedAt(fetchedAt);
    localStorage.setItem("rov_profile", JSON.stringify(data));
    localStorage.setItem("rov_profile_time", String(fetchedAt));
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
    if (!me) return null;

    dispatch(syncCustomerBundle(me));

    const syncedLocation = getLocationStateFromUser(me, location);
    if (syncedLocation) {
      dispatch(setCustomerLocation(syncedLocation));
    }

    // These values are UI caches only. Authentication still comes exclusively
    // from the HttpOnly cookie validated by /auth/me.
    localStorage.setItem("user", JSON.stringify(me));
    localStorage.setItem("rov_user", JSON.stringify(me));

    syncVehicles(me.vehicles || []);

    return me;
  };

  const syncAuthenticatedUser = (me) => {
    if (!me) return null;

    if (me.accountType === "USER" && me.role === "CUSTOMER") {
      return syncUserData(me);
    }

    // Staff accounts use the same top-level user state, but should not be
    // treated as customer profile/vehicle data.
    dispatch(setCustomerUser(me));
    localStorage.setItem("user", JSON.stringify(me));
    localStorage.setItem("rov_user", JSON.stringify(me));

    return me;
  };

  const login = (userData) => {
    if (!userData) {
      throw new Error("User data is required");
    }

    // The shared HttpOnly cookie can represent only one role at a time.
    clearCustomerSession({ clearRole: false });
    clearGarageSession({ clearRole: false });
    localStorage.removeItem("token");
    if (!isValidSessionIdentity(userData)) {
      throw new Error("Invalid authenticated account");
    }

    setSessionRole(
      userData.role,
      userData.accountType,
    );

    syncAuthenticatedUser(userData);
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

  const fetchMe = async ({ sync = true } = {}) => {
    if (authRequestRef.current) {
      return authRequestRef.current;
    }

    let request;
    request = (async () => {
      try {
        const response = await api.get("/auth/me", {
          skipSessionExpiryMessage: true,
        });
        const me = response.data?.data;

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
          clearAllLocalSessions();
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

  const refreshGarage = async () => {
    if (garageRequestRef.current) {
      return garageRequestRef.current;
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
      await garageApi.logout();
    } catch {
      // Local cleanup still happens if the server session is already gone.
    }

    clearAllLocalSessions();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local cleanup still happens if the server session is already gone.
    }

    clearAllLocalSessions();
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
          "PENDING_PAYMENT,SEARCHING_GARAGE,GARAGE_ASSIGNED,CONFIRMED,IN_PROGRESS",
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
      const me = await fetchMe({ sync: false });

      if (!me) {
        if (active) {
          setAuthLoading(false);
        }
        return;
      }

      if (me.accountType === "USER" && me.role === "GARAGE_OWNER") {
        clearCustomerSession({ clearRole: false });
        await refreshGarage();
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
    let lastRefreshAt = Date.now();

    const refreshRestoredSession = () => {
      const now = Date.now();

      if (now - lastRefreshAt < 30000) {
        return;
      }

      lastRefreshAt = now;

      if (user) {
        fetchMe();
        return;
      }

      if (garageUser) {
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
    const handleSessionExpired = () => {
      clearAllLocalSessions();
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
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("rov_user", JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (garageUser) {
      localStorage.setItem("garage", JSON.stringify(garageUser));
    }
  }, [garageUser]);

  useEffect(() => {
    localStorage.setItem("rov_vehicle", JSON.stringify(vehicle));
  }, [vehicle]);

  useEffect(() => {
    localStorage.setItem("rov_vehicles", JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    localStorage.setItem("rov_location", JSON.stringify(location));
  }, [location]);

  const setUser = (value) => {
    const nextUser = typeof value === "function" ? value(user) : value;
    dispatch(setCustomerUser(nextUser));
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
    setCart((current) => {
      const exists = current.find((item) => item.id === service.id);
      return exists ? current : [...current, service];
    });
  };

  const removeFromCart = (id) => {
    setCart((current) => current.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const value = {
    user,
    garage: garageUser,
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
