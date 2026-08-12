const normalize = (value) => String(value || "").trim().toLowerCase();

export const queryKeys = {
  customer: {
    root: ["customer"],
    dashboard: (userId) => ["customer", userId || "anonymous", "dashboard"],
    vehicles: (userId) => ["customer", userId || "anonymous", "vehicles"],
    activeBookings: (userId) => ["customer", userId || "anonymous", "bookings", "active"],
    serviceHistory: (userId) => ["customer", userId || "anonymous", "bookings", "history"],
    profile: (userId) => ["customer", userId || "anonymous", "profile"],
    serviceCategories: ({ userId, vehicleId, city } = {}) => [
      "services",
      "categories",
      userId || "public",
      vehicleId || "all-vehicles",
      normalize(city) || "all-cities",
    ],
    vehicleMeta: ["vehicles", "catalog"],
  },
  admin: {
    root: ["admin"],
    independenceCampaign: ["admin", "independence-campaign"],
    customers: (params = {}) => ["admin", "customers", params],
    vehicles: (params = {}) => ["admin", "vehicles", params],
    customerLoginHistory: (userId) => ["admin", "customers", userId, "login-history"],
  },
};
