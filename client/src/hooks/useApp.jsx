import { createContext, useContext, useEffect, useState } from "react";
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

export function AppProvider({ children }) {
  const dispatch = useDispatch();

  const { user, vehicle, vehicles, location } =
    useSelector(selectCustomerState);
  const { garage: garageUser } = useSelector(selectGarageState);

  const [cart, setCart] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

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

  const clearCustomerSession = () => {
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
  };

  const clearGarageSession = () => {
    // Remove legacy JWT storage left by older frontend versions.
    localStorage.removeItem("garage_token");
    localStorage.removeItem("garage");
    dispatch(clearGarageState());
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

  const login = (userData) => {
    if (!userData) {
      throw new Error("User data is required");
    }

    // Delete old browser-readable tokens during the migration.
    localStorage.removeItem("token");

    syncUserData(userData);

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

    localStorage.removeItem("garage_token");
    localStorage.setItem("garage", JSON.stringify(garageData));
    dispatch(setGarage(garageData));
  };

  const fetchMe = async () => {
    try {
      const response = await api.get("/auth/me");
      const me = response.data?.data;

      if (!me) {
        throw new Error("Invalid current-user response");
      }

      return syncUserData(me);
    } catch (err) {
      if (err.response?.status === 401) {
        clearCustomerSession();
      }

      return null;
    }
  };

  const refreshGarage = async () => {
    try {
      // garageApi.getProfile must use the shared Axios instance and must not
      // require a token argument.
      const garageData = await garageApi.getProfile();

      if (!garageData) {
        throw new Error("Invalid garage profile response");
      }

      localStorage.setItem("garage", JSON.stringify(garageData));
      dispatch(setGarage(garageData));

      return garageData;
    } catch (err) {
      if (err.response?.status === 401) {
        clearGarageSession();
      }

      return null;
    }
  };

  const logoutGarage = async () => {
    try {
      // Add garageApi.logout() to client/src/api/garage.js if it does not
      // already exist. It must call the garage logout endpoint with cookies.
      await garageApi.logout();
    } catch {
      // Local cleanup still happens if the server session is already gone.
    }

    clearGarageSession();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local cleanup still happens if the server session is already gone.
    }

    clearCustomerSession();
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

    const response = await api.get("/customer/profile");
    const data = response.data.data;
    const fetchedAt = Date.now();

    saveProfileCache(data, fetchedAt);
    syncUserData(data);

    return data;
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

    const restoreSessions = async () => {
      // HttpOnly cookies cannot be read from JavaScript, so probe both session
      // endpoints. A 401 simply means that role has no active session.
      await Promise.allSettled([fetchMe(), refreshGarage()]);

      if (active) {
        setAuthLoading(false);
      }
    };

    restoreSessions();

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

      const requests = [];

      if (user) {
        requests.push(fetchMe());
      }

      if (garageUser) {
        requests.push(refreshGarage());
      }

      if (requests.length > 0) {
        Promise.allSettled(requests);
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
