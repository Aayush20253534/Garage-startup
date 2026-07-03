import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

const authConfig = (token, config = {}) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});

export const normalizeGarage = (garage) => {
  if (!garage) return null;

  const wallet = garage.wallet || {};
  const activation = garage.activation || {};
  const owner = garage.owner || {};
  const images = Array.isArray(garage.images) ? garage.images : [];

  return {
    ...garage,
    ownerName: owner.name || garage.ownerName || garage.name,
    ownerEmail: owner.email || garage.email,
    name: garage.name || garage.garageName || "Garage",
    phone: garage.phone || owner.phone || "",
    email: garage.email || owner.email || "",
    walletBalance: wallet.balance || activation.walletBalance || 0,
    imageCount: images.length || activation.photoCount || 0,
    minimumBalance: activation.minimumBalance || 1000,
    isOnboardingComplete: Boolean(garage.isVerified),
    activation: {
      minimumBalance: activation.minimumBalance || 1000,
      walletBalance: wallet.balance || activation.walletBalance || 0,
      photoCount: images.length || activation.photoCount || 0,
      hasMinimumBalance:
        activation.hasMinimumBalance ?? (wallet.balance || 0) >= (activation.minimumBalance || 1000),
      isActive: activation.isActive ?? garage.isActive,
    },
  };
};

export const mapGarageRequestToBooking = (request) => {
  const booking = request.booking || {};
  const vehicle = booking.vehicle || {};
  const customer = booking.user || {};
  const services = Array.isArray(booking.services) ? booking.services : [];
  const status = booking.deliveredAt && !booking.customerAcceptedAt ? "DELIVERED" : request.status === "SENT" ? "NEW" : booking.status || request.status;

  return {
    id: request.id,
    requestId: request.id,
    bookingId: booking.id,
    status,
    createdAt: booking.createdAt || request.createdAt,
    distance: request.distanceKm || request.distance || 0,
    estimatedBill: booking.totalServiceMaxAmount || booking.totalServiceAmount || 0,
    raw: request,
    customerLocationLink: request.customerLocationLink,
    handoverOtpExpiresAt: booking.handoverOtpExpiresAt,
    deliveredAt: booking.deliveredAt,
    customerAcceptedAt: booking.customerAcceptedAt,
    vehicle: {
      brand: vehicle.brand || vehicle.make || "Vehicle",
      model: vehicle.model || "",
      year: vehicle.year || "",
      number: vehicle.registrationNumber || vehicle.number || vehicle.plateNumber || "",
    },
    customer: {
      name: customer.name || "Customer",
      phone: customer.phone || "",
      address: booking.customerAddress || booking.address || "",
      location: {
        lat: booking.customerLatitude,
        lng: booking.customerLongitude,
      },
    },
    services: services.map((item) => ({
      id: item.serviceId || item.service?.id,
      name: item.service?.name || item.name || "Service",
      price: item.price || item.service?.basePrice || 0,
    })),
  };
};

export const garageApi = {
  async login(identifier, password) {
    const result = unwrap(await api.post("/auth/login", { identifier, password, role: "GARAGE_OWNER" }));
    if (!["GARAGE_OWNER", "ADMIN"].includes(result.user?.role)) {
      throw new Error("This account is not a garage owner account");
    }
    const garage = await this.getProfile(result.token);
    return { user: result.user, token: result.token, garage };
  },

  async getProfile(token) {
    const garage = unwrap(await api.get("/garages/me", authConfig(token)));
    return normalizeGarage(garage);
  },

  async submitApplication(payload) {
    return unwrap(await api.post("/garage/applications", payload));
  },

  async geocodeApplicationLocation({ address, city, area }) {
    const result = unwrap(
      await api.get("/garage/applications/geocode", {
        params: {
          address,
          city,
          state: area,
        },
      })
    );

    return {
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      displayName: result.displayName,
      corrected: Boolean(result.corrected),
    };
  },

  async getWallet(token) {
    return unwrap(await api.get("/garage/wallet", authConfig(token)));
  },

  async getWalletTransactions(token) {
    return unwrap(await api.get("/garage/wallet/transactions", authConfig(token)));
  },

  async createRechargeOrder(token, amount) {
    return unwrap(await api.post("/garage/wallet/recharge/order", { amount }, authConfig(token)));
  },

  async verifyRechargeOrder(token, cashfreeOrderId) {
    return unwrap(await api.post("/garage/wallet/recharge/verify", { cashfreeOrderId }, authConfig(token)));
  },

  async changePassword(token, currentPassword, newPassword) {
    return unwrap(await api.post("/auth/change-password", { currentPassword, newPassword }, authConfig(token)));
  },

  async uploadPhotos(token, garageId, files) {
    const formData = new FormData();
    const imageFiles = files.map((item) => item.file || item).filter(Boolean);

    imageFiles.forEach((file, index) => {
      formData.append(index === 0 ? "thumbnail" : "images", file);
    });

    const garage = unwrap(
      await api.post(`/garages/${garageId}/media`, formData, authConfig(token, {
        headers: { "Content-Type": "multipart/form-data" },
      }))
    );

    return normalizeGarage(garage);
  },

  async getRequests(token, status = "") {
    const params = status ? { status } : {};
    const requests = unwrap(await api.get("/garage/requests", authConfig(token, { params })));
    return Array.isArray(requests) ? requests.map(mapGarageRequestToBooking) : [];
  },

  async acceptRequest(token, requestId, note = "") {
    const request = unwrap(await api.post(`/garage/requests/${requestId}/accept`, { note }, authConfig(token)));
    return mapGarageRequestToBooking(request);
  },

  async rejectRequest(token, requestId, note = "") {
    const request = unwrap(await api.post(`/garage/requests/${requestId}/reject`, { note }, authConfig(token)));
    return mapGarageRequestToBooking(request);
  },

  async verifyHandoverOtp(token, requestId, otp, images = []) {
    const formData = new FormData();
    formData.append("otp", otp);
    images.map((item) => item.file || item).filter(Boolean).forEach((file) => formData.append("images", file));
    return unwrap(await api.post(`/garage/requests/${requestId}/verify-handover-otp`, formData, authConfig(token, {
      headers: { "Content-Type": "multipart/form-data" },
    })));
  },

  async markDelivered(token, requestId, images = []) {
    const formData = new FormData();
    images.map((item) => item.file || item).filter(Boolean).forEach((file) => formData.append("images", file));
    return unwrap(await api.post(`/garage/requests/${requestId}/mark-delivered`, formData, authConfig(token, {
      headers: { "Content-Type": "multipart/form-data" },
    })));
  },
};
