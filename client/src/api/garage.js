import api from "@/api/axios";
import { verifyCurrentSession } from "@/utils/authSession";

const unwrap = (response) => response.data?.data ?? response.data;
const GARAGE_MINIMUM_ACTIVATION_BALANCE = 1;

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
    minimumBalance:
      activation.minimumBalance || GARAGE_MINIMUM_ACTIVATION_BALANCE,
    isOnboardingComplete: Boolean(garage.isVerified),
    activation: {
      minimumBalance:
        activation.minimumBalance || GARAGE_MINIMUM_ACTIVATION_BALANCE,
      walletBalance: wallet.balance || activation.walletBalance || 0,
      photoCount: images.length || activation.photoCount || 0,
      hasMinimumBalance:
        activation.hasMinimumBalance ??
        (wallet.balance || 0) >=
          (activation.minimumBalance || GARAGE_MINIMUM_ACTIVATION_BALANCE),
      isActive: activation.isActive ?? garage.isActive,
    },
  };
};

export const mapGarageRequestToBooking = (request) => {
  const booking = request.booking || {};
  const vehicle = booking.vehicle || {};
  const customer = booking.user || {};
  const services = Array.isArray(booking.services) ? booking.services : [];

  const status =
    request.status === "SENT"
      ? "NEW"
      : request.status === "ACCEPTED"
        ? booking.deliveredAt && !booking.customerAcceptedAt
          ? "DELIVERED"
          : booking.status || request.status
        : request.status;

  return {
    id: request.id,
    requestId: request.id,
    bookingId: booking.id,
    status,
    createdAt: booking.createdAt || request.createdAt,
    distance: request.distanceKm || request.distance || 0,
    etaMinutes: request.etaMinutes || null,
    acceptUrl: request.acceptUrl,
    estimatedBill:
      booking.totalServiceMaxAmount || booking.totalServiceAmount || 0,
    raw: request,
    customerLocationLink: request.customerLocationLink,
    handoverOtpExpiresAt: booking.handoverOtpExpiresAt,
    deliveredAt: booking.deliveredAt,
    customerAcceptedAt: booking.customerAcceptedAt,
    inspectionImages: Array.isArray(booking.inspectionImages)
      ? booking.inspectionImages
      : [],
    vehicle: {
      brand: vehicle.brand || vehicle.make || "Vehicle",
      model: vehicle.model || "",
      year: vehicle.year || "",
      number:
        vehicle.registrationNumber ||
        vehicle.number ||
        vehicle.plateNumber ||
        "",
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

const getStatusArgument = (args) => {
  if (args.length >= 2) {
    return args.at(-1) || "";
  }

  const value = args[0];

  // Supports both getRequests(status) and a temporary old
  // getRequests(undefined, status) call during migration.
  return typeof value === "string" && !value.includes(".") ? value : "";
};

export const garageApi = {
  async login(identifier, password) {
    const result = unwrap(
      await api.post("/auth/login", {
        identifier,
        password,
        role: "GARAGE_OWNER",
      }),
    );

    await verifyCurrentSession({ expectedRole: "GARAGE_OWNER" });

    if (!result?.user) {
      throw new Error("Invalid garage login response");
    }

    if (!["GARAGE_OWNER", "ADMIN"].includes(result.user.role)) {
      throw new Error("This account is not a garage owner account");
    }

    // Login sets an HttpOnly cookie. The profile request proves that the
    // browser received it and that the session is usable.
    const garage = await this.getProfile();

    return {
      user: result.user,
      garage,
    };
  },

  async logout() {
    return unwrap(await api.post("/auth/logout"));
  },

  async getProfile() {
    const garage = unwrap(await api.get("/garages/me"));
    return normalizeGarage(garage);
  },

  async updateProfile(...args) {
    // New: updateProfile(payload)
    // Temporary compatibility: updateProfile(undefined, payload)
    const payload = args.at(-1);
    const garage = unwrap(await api.put("/garages/me", payload));
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
      }),
    );

    return {
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      displayName: result.displayName,
      corrected: Boolean(result.corrected),
    };
  },

  async getWallet() {
    return unwrap(await api.get("/garage/wallet"));
  },

  async getWalletTransactions() {
    return unwrap(await api.get("/garage/wallet/transactions"));
  },

  async createRechargeOrder(...args) {
    // New: createRechargeOrder(amount)
    const amount = args.at(-1);

    return unwrap(
      await api.post("/garage/wallet/recharge/order", {
        amount,
      }),
    );
  },

  async verifyRechargeOrder(...args) {
    // New: verifyRechargeOrder(cashfreeOrderId)
    const cashfreeOrderId = args.at(-1);

    return unwrap(
      await api.post("/garage/wallet/recharge/verify", {
        cashfreeOrderId,
      }),
    );
  },

  async changePassword(...args) {
    // New: changePassword(currentPassword, newPassword)
    const [currentPassword, newPassword] = args.slice(-2);

    return unwrap(
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      }),
    );
  },

  async uploadPhotos(...args) {
    // New: uploadPhotos(garageId, files)
    const [garageId, files = []] = args.slice(-2);

    const formData = new FormData();
    const imageFiles = files.map((item) => item.file || item).filter(Boolean);

    imageFiles.forEach((file, index) => {
      formData.append(index === 0 ? "thumbnail" : "images", file);
    });

    const garage = unwrap(
      await api.post(`/garages/${garageId}/media`, formData),
    );

    return normalizeGarage(garage);
  },

  async getRequests(...args) {
    // New: getRequests(status)
    const status = getStatusArgument(args);
    const params = status ? { status } : {};

    const requests = unwrap(
      await api.get("/garage/requests", {
        params,
      }),
    );

    return Array.isArray(requests)
      ? requests.map(mapGarageRequestToBooking)
      : [];
  },

  async acceptRequest(...args) {
    // New: acceptRequest(requestId, note)
    const [requestId, note = ""] = args.slice(-2);

    const request = unwrap(
      await api.post(`/garage/requests/${requestId}/accept`, {
        note,
      }),
    );

    return mapGarageRequestToBooking(request);
  },

  async rejectRequest(...args) {
    // New: rejectRequest(requestId, note)
    const [requestId, note = ""] = args.slice(-2);

    const request = unwrap(
      await api.post(`/garage/requests/${requestId}/reject`, {
        note,
      }),
    );

    return mapGarageRequestToBooking(request);
  },

  async verifyHandoverOtp(...args) {
    // New: verifyHandoverOtp(requestId, otp, images)
    const [requestId, otp, images = []] = args.slice(-3);

    const formData = new FormData();
    formData.append("otp", otp);

    images
      .map((item) => item.file || item)
      .filter(Boolean)
      .forEach((file) => formData.append("images", file));

    return unwrap(
      await api.post(
        `/garage/requests/${requestId}/verify-handover-otp`,
        formData,
      ),
    );
  },

  async markDelivered(...args) {
    // New: markDelivered(requestId, images)
    const [requestId, images = []] = args.slice(-2);

    const formData = new FormData();

    images
      .map((item) => item.file || item)
      .filter(Boolean)
      .forEach((file) => formData.append("images", file));

    return unwrap(
      await api.post(
        `/garage/requests/${requestId}/mark-delivered`,
        formData,
      ),
    );
  },
};
