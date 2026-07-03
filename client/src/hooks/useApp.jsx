import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "@/api/axios";
import { garageApi } from "@/api/garage";
import { getLocationStateFromUser } from "@/utils/address";
import {
  clearCustomerState,
  selectCustomerState,
  setCustomerLocation,
  setCustomerToken,
  setCustomerUser,
  setCustomerVehicle,
  setCustomerVehicles,
  syncCustomerBundle,
} from "@/store/customerSlice";
import {
  clearGarageState,
  selectGarageState,
  setGarage,
  setGarageToken,
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

const readArray = (key) => {
  const value = readJson(key, []);
  return Array.isArray(value) ? value : [];
};

const readNumber = (key, fallback = null) => {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function AppProvider({ children }) {
  const dispatch = useDispatch();
  const { user, token, vehicle, vehicles, location } =
    useSelector(selectCustomerState);
  const { garage: garageUser, token: garageToken } =
    useSelector(selectGarageState);
  const [cart, setCart] = useState([]);

  const [authLoading, setAuthLoading] = useState(true);

  const [dashboardCache, setDashboardCache] = useState(() =>
    readJson("rov_dashboard", null)
  );
  const [dashboardFetchedAt, setDashboardFetchedAt] = useState(() =>
    readNumber("rov_dashboard_time", null)
  );

  const [serviceCategoriesCache, setServiceCategoriesCache] = useState(() =>
    readJson("rov_service_categories", null)
  );
  const [serviceCategoriesFetchedAt, setServiceCategoriesFetchedAt] = useState(() =>
    readNumber("rov_service_categories_time", null)
  );

  const [vehicleMetaCache, setVehicleMetaCache] = useState(() =>
    readJson("rov_vehicle_meta", null)
  );
  const [vehicleMetaFetchedAt, setVehicleMetaFetchedAt] = useState(() =>
    readNumber("rov_vehicle_meta_time", null)
  );

  const [vehiclesCache, setVehiclesCache] = useState(() =>
    readJson("rov_vehicles_cache", null)
  );
  const [vehiclesFetchedAt, setVehiclesFetchedAt] = useState(() =>
    readNumber("rov_vehicles_cache_time", null)
  );

  const [activeBookingsCache, setActiveBookingsCache] = useState(() =>
    readJson("rov_active_bookings", null)
  );
  const [activeBookingsFetchedAt, setActiveBookingsFetchedAt] = useState(() =>
    readNumber("rov_active_bookings_time", null)
  );

  const [serviceHistoryCache, setServiceHistoryCache] = useState(() =>
    readJson("rov_service_history", null)
  );
  const [serviceHistoryFetchedAt, setServiceHistoryFetchedAt] = useState(() =>
    readNumber("rov_service_history_time", null)
  );
  const [profileCache, setProfileCache] = useState(() =>
    readJson("rov_profile", null)
  );

  const [profileFetchedAt, setProfileFetchedAt] = useState(() =>
    readNumber("rov_profile_time", null)
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

  const clearLocalSession = () => {
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

    localStorage.setItem("user", JSON.stringify(me));
    localStorage.setItem("rov_user", JSON.stringify(me));

    syncVehicles(me.vehicles || []);

    return me;
  };

  const login = (userData, authToken) => {
    if (authToken) {
      localStorage.setItem("token", authToken);
      dispatch(setCustomerToken(authToken));
    }

    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("rov_user", JSON.stringify(userData));

    if (!authToken) dispatch(setCustomerToken("cookie"));
    dispatch(syncCustomerBundle(userData));

    clearDashboardCache();
    clearVehiclesCache();
    clearActiveBookingsCache();
    clearServiceHistoryCache();
    clearProfileCache();
  };

  const loginGarage = (garageData, authToken) => {
    if (authToken) {
      localStorage.setItem("garage_token", authToken);
      dispatch(setGarageToken(authToken));
    }

    localStorage.setItem("garage", JSON.stringify(garageData));
    dispatch(setGarage(garageData));
  };

  const refreshGarage = async (authToken = garageToken || localStorage.getItem("garage_token")) => {
    if (!authToken) return null;

    const garageData = await garageApi.getProfile(authToken);
    localStorage.setItem("garage", JSON.stringify(garageData));
    dispatch(setGarage(garageData));
    dispatch(setGarageToken(authToken));
    return garageData;
  };

  const logoutGarage = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local cleanup still needs to happen if the server session is already gone.
    }

    localStorage.removeItem("garage_token");
    localStorage.removeItem("garage");
    dispatch(clearGarageState());
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local cleanup still needs to happen if the server session is already gone.
    }

    clearLocalSession();
  };

  const fetchMe = async () => {
    try {
      const res = await api.get("/auth/me");
      const me = res.data.data;

      dispatch(setCustomerToken(localStorage.getItem("token") || "cookie"));
      return syncUserData(me);
    } catch (err) {
      if (err.response?.status === 401) {
        clearLocalSession();
        return null;
      }

      const cachedUser = readJson("user", readJson("rov_user", null));
      if (cachedUser) {
        dispatch(setCustomerToken(localStorage.getItem("token") || "cookie"));
        return syncUserData(cachedUser);
      }

      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchDashboard = async ({ force = false } = {}) => {
    const now = Date.now();

    if (!force && dashboardCache && dashboardFetchedAt) {
      if (now - dashboardFetchedAt < DASHBOARD_CACHE_TTL) {
        return dashboardCache;
      }
    }

    const res = await api.get("/dashboard/customer");
    const data = res.data.data;
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

    if (!force && vehiclesCache && vehiclesFetchedAt) {
      if (now - vehiclesFetchedAt < VEHICLES_CACHE_TTL) {
        syncVehicles(vehiclesCache);
        return vehiclesCache;
      }
    }

    const res = await api.get("/vehicles");
    const data = res.data.data || [];
    const fetchedAt = Date.now();

    saveVehiclesCache(data, fetchedAt);
    syncVehicles(data);

    return data;
  };

  const fetchActiveBookings = async ({ force = false } = {}) => {
    const now = Date.now();

    if (!force && activeBookingsCache && activeBookingsFetchedAt) {
      if (now - activeBookingsFetchedAt < ACTIVE_BOOKINGS_CACHE_TTL) {
        return activeBookingsCache;
      }
    }

    const res = await api.get("/bookings", {
      params: {
        status:
          "PENDING_PAYMENT,SEARCHING_GARAGE,GARAGE_ASSIGNED,CONFIRMED,IN_PROGRESS",
      },
    });

    const data = res.data.data || [];
    const fetchedAt = Date.now();

    saveActiveBookingsCache(data, fetchedAt);

    return data;
  };

  const fetchServiceHistory = async ({ force = false } = {}) => {
    const now = Date.now();

    if (!force && serviceHistoryCache && serviceHistoryFetchedAt) {
      if (now - serviceHistoryFetchedAt < SERVICE_HISTORY_CACHE_TTL) {
        return serviceHistoryCache;
      }
    }

    const res = await api.get("/bookings", {
      params: {
        status: "COMPLETED",
      },
    });

    const data = res.data.data || [];
    const fetchedAt = Date.now();

    saveServiceHistoryCache(data, fetchedAt);

    return data;
  };

  const fetchProfile = async ({ force = false } = {}) => {
  const now = Date.now();

  if (!force && profileCache && profileFetchedAt) {
    if (now - profileFetchedAt < PROFILE_CACHE_TTL) {
      return profileCache;
    }
  }

  const res = await api.get("/customer/profile");
  const data = res.data.data;
  const fetchedAt = Date.now();

  saveProfileCache(data, fetchedAt);
  dispatch(syncCustomerBundle(data));

  const syncedLocation = getLocationStateFromUser(data, location);
  if (syncedLocation) {
    dispatch(setCustomerLocation(syncedLocation));
  }

  localStorage.setItem("user", JSON.stringify(data));
  localStorage.setItem("rov_user", JSON.stringify(data));

  return data;
};
  const fetchServiceCategories = async ({ force = false } = {}) => {
    const now = Date.now();

    if (!force && serviceCategoriesCache && serviceCategoriesFetchedAt) {
      if (now - serviceCategoriesFetchedAt < SERVICES_CACHE_TTL) {
        return serviceCategoriesCache;
      }
    }

    const res = await api.get("/services/categories");
    const data = res.data.data || [];
    const fetchedAt = Date.now();

    saveServiceCategoriesCache(data, fetchedAt);

    return data;
  };

  const fetchVehicleMeta = async ({ force = false } = {}) => {
    const now = Date.now();

    if (!force && vehicleMetaCache && vehicleMetaFetchedAt) {
      if (now - vehicleMetaFetchedAt < VEHICLE_META_CACHE_TTL) {
        return vehicleMetaCache;
      }
    }

    const res = await api.get("/vehicle-meta/brands");
    const data = res.data.data || [];
    const fetchedAt = Date.now();

    saveVehicleMetaCache(data, fetchedAt);

    return data;
  };

  useEffect(() => {
    const savedGarage = localStorage.getItem("garage");
    const savedGarageToken = localStorage.getItem("garage_token");

    if (savedGarage) {
      try {
        const garageData = JSON.parse(savedGarage);
        dispatch(setGarage(garageData));
        if (savedGarageToken) {
          dispatch(setGarageToken(savedGarageToken));
          // Refresh garage profile in background but don't log out on error
          garageApi.getProfile(savedGarageToken)
            .then((freshGarage) => {
              localStorage.setItem("garage", JSON.stringify(freshGarage));
              dispatch(setGarage(freshGarage));
            })
            .catch((err) => {
              // Log error but keep user logged in with cached garage data
              console.warn("Failed to refresh garage profile:", err.message);
              // Only logout if it's a 401 (unauthorized/token invalid)
              if (err.response?.status === 401) {
                logoutGarage();
              }
            });
        }
      } catch {}
    }

    if (token && user) {
      setAuthLoading(false);
      return;
    }

    if (token) {
      fetchMe();
      return;
    }

    setAuthLoading(false);
  }, []);

  useEffect(() => {
    let lastRefreshAt = Date.now();

    const refreshRestoredSession = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 30000) return;
      lastRefreshAt = now;

      const savedToken = localStorage.getItem("token");
      const savedGarageToken = localStorage.getItem("garage_token");

      if (savedToken) {
        fetchMe();
      }

      if (savedGarageToken) {
        refreshGarage(savedGarageToken).catch((err) => {
          if (err.response?.status === 401) logoutGarage();
        });
      }
    };

    const onPageShow = (event) => {
      if (event.persisted) refreshRestoredSession();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshRestoredSession();
    };

    const onOnline = () => refreshRestoredSession();

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("rov_user", JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (token && token !== "cookie") {
      localStorage.setItem("token", token);
    }
  }, [token]);

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

  const setToken = (value) => {
    dispatch(setCustomerToken(value));
  };

  const setVehicle = (value) => {
    const nextVehicle = typeof value === "function" ? value(vehicle) : value;
    dispatch(setCustomerVehicle(nextVehicle));
  };

  const setVehicles = (value) => {
    const nextVehicles = typeof value === "function" ? value(vehicles) : value;
    dispatch(setCustomerVehicles(nextVehicles));
  };

  const setLocation = (value) => {
    const nextLocation = typeof value === "function" ? value(location) : value;
    dispatch(setCustomerLocation(nextLocation));
  };

  const addVehicle = (v) => {
    const currentVehicles = Array.isArray(vehicles) ? vehicles : [];
    const newVehicle = {
      ...v,
      id: v.id || `local-${Date.now()}`,
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

  const value = useMemo(
    () => ({
      user,
      token,
      garage: garageUser,
      garageToken,
      vehicle,
      vehicles,
      cart,
      location,
      authLoading,

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
      setToken,
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
    }),
    [
      user,
      token,
      garageUser,
      garageToken,
      vehicle,
      vehicles,
      cart,
      location,
      authLoading,
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
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => {
  const value = useContext(AppCtx);

  if (!value) {
    throw new Error("useApp must be used within AppProvider");
  }

  return value;
};
