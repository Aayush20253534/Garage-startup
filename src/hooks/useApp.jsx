import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_VEHICLE } from "@/data/vehicles";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rov_user")) || null; } catch { return null; }
  });
  const [vehicle, setVehicle] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rov_vehicle")) || null; } catch { return null; }
  });
  const [vehicles, setVehicles] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rov_vehicles")) || []; } catch { return []; }
  });
  const [cart, setCart] = useState([]);
  const [location, setLocation] = useState({ area: "Indirapuram", city: "Ghaziabad", pincode: "201014" });

  useEffect(() => { localStorage.setItem("rov_user", JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem("rov_vehicle", JSON.stringify(vehicle)); }, [vehicle]);
  useEffect(() => { localStorage.setItem("rov_vehicles", JSON.stringify(vehicles)); }, [vehicles]);

  const login = (name, role = "customer") => {
    setUser({ name: name || "Ayush", role });
  };
  const logout = () => { setUser(null); };
  const addVehicle = (v) => {
    const nv = { ...v, id: "v" + (vehicles.length + 1) };
    setVehicles([...vehicles, nv]); setVehicle(nv);
  };
  const addToCart = (svc) => setCart((c) => c.find((x) => x.id === svc.id) ? c : [...c, svc]);
  const removeFromCart = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const clearCart = () => setCart([]);

  const value = useMemo(() => ({
    user, vehicle, vehicles, cart, location,
    setUser, setVehicle, setVehicles, setCart, setLocation,
    login, logout, addVehicle, addToCart, removeFromCart, clearCart,
  }), [user, vehicle, vehicles, cart, location]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
};
