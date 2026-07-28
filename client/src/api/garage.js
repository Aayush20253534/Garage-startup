import api from "@/api/axios";
import { verifyCurrentSession } from "@/utils/authSession";
import { normalizeMediaCollection } from "@/utils/mediaUrl";

const unwrap = (response) => response.data?.data ?? response.data;
const GARAGE_MINIMUM_ACTIVATION_BALANCE = 100;

export const normalizeGarage = (garage) => {
  if (!garage) return null;

  const wallet = garage.wallet || {};
  const activation = garage.activation || {};
  const owner = garage.owner || {};
  const images = normalizeMediaCollection(garage.images);

  const reviews = Array.isArray(garage.reviews)
    ? garage.reviews
    : Array.isArray(garage.recentReviews)
      ? garage.recentReviews
      : [];
  const walletBalance = Number(wallet.balance ?? activation.walletBalance ?? 0);
  const minimumActivationAmount = Number(
    activation.minimumActivationAmount ??
      activation.minimumBalance ??
      GARAGE_MINIMUM_ACTIVATION_BALANCE
  );
  const ratingAvg = Number(
    garage.ratingAvg ?? garage.averageRating ?? garage.rating ?? 0
  );
  const ratingCount = Number(
    garage.ratingCount ??
      garage.reviewCount ??
      garage.reviewSummary?.count ??
      reviews.length ??
      0
  );
  const isActive = activation.isActive ?? garage.isActive;
  const hasActivationBalance =
    Boolean(isActive) || walletBalance >= minimumActivationAmount;

  return {
    ...garage,
    ownerName: owner.name || garage.ownerName || garage.name,
    ownerEmail: owner.email || garage.email,
    name: garage.name || garage.garageName || "Garage",
    phone: garage.phone || owner.phone || "",
    email: garage.email || owner.email || "",
    walletBalance,
    imageCount: images.length || activation.photoCount || 0,
    minimumBalance: minimumActivationAmount,
    minimumActivationAmount,
    rating: ratingAvg,
    ratingAvg,
    reviewCount: ratingCount,
    ratingCount,
    reviews,
    recentReviews: reviews,
    images,
    isOnboardingComplete: Boolean(garage.isVerified),
    activation: {
      minimumBalance: minimumActivationAmount,
      minimumActivationAmount,
      walletBalance,
      photoCount: images.length || activation.photoCount || 0,
      hasMinimumBalance:
        Boolean(isActive) || (activation.hasMinimumBalance ?? hasActivationBalance),
      hasActivationBalance:
        Boolean(isActive) ||
        (activation.hasActivationBalance ?? hasActivationBalance),
      isActive,
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
      bookingCode: booking.bookingCode,
      status,
      fulfillmentType: booking.fulfillmentType || "PICKUP_DELIVERY",
    createdAt: booking.createdAt || request.createdAt,
    distance: request.distanceKm || request.distance || 0,
    etaMinutes: request.etaMinutes || null,
    acceptUrl: request.acceptUrl,
    estimatedBill:
      booking.totalServiceMaxAmount || booking.totalServiceAmount || 0,
    acceptFee: request.acceptFee || booking.handlingFee || 0,
    raw: request,
    review: booking.review || null,
    customerLocationLink: request.customerLocationLink,
    handoverOtpExpiresAt: booking.handoverOtpExpiresAt,
    handoverOtpVerifiedAt: booking.handoverOtpVerifiedAt,
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
      price:
        item.finalPrice ??
        item.estimatedMaxPrice ??
        item.estimatedPrice ??
        item.price ??
        0,
      minPrice: item.estimatedMinPrice ?? item.estimatedPrice ?? null,
      maxPrice: item.estimatedMaxPrice ?? item.estimatedPrice ?? null,
      finalPrice: item.finalPrice ?? null,
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
  async login(identifier, password, role = "GARAGE_OWNER") {
    const result = unwrap(
      await api.post("/auth/login", {
        identifier,
        password,
        role,
      }),
    );

    const sessionUser = await verifyCurrentSession({
      expectedRole: role,
    });

    const user = sessionUser || result?.user;

    if (!user) {
      throw new Error("Invalid garage login response");
    }

    if (!["GARAGE_OWNER", "GARAGE_CONTROLLER", "ADMIN"].includes(user.role)) {
      throw new Error("This account is not a garage owner account");
    }

    // A newly approved garage keeps the phone-number temporary password, but
    // cannot enter the portal until it creates a private password.
    if (user.mustChangePassword) {
      return {
        user,
        garage: {
          ownerName: user.name,
          name: user.name || "Garage",
          email: user.email || "",
          phone: user.phone || "",
          role: user.role,
          mustChangePassword: true,
          isFirstLogin: true,
        },
      };
    }

    // Login sets an HttpOnly cookie. The profile request proves that the
    // browser received it and that the session is usable.
    const garage = await this.getProfile();

    return {
      user,
      garage: { ...garage, role: user.role, accountType: user.accountType, sessionUser: user },
    };
  },

  async getControllers() {
    return unwrap(await api.get("/garage/controllers"));
  },

  async getControllerActivity(controllerId) {
    return unwrap(await api.get(`/garage/controllers/${controllerId}/activity`));
  },

  async createController(payload) {
    return unwrap(await api.post("/garage/controllers", payload));
  },

  async updateController(controllerId, payload) {
    return unwrap(await api.patch(`/garage/controllers/${controllerId}`, payload));
  },

  async resetControllerPassword(controllerId, password) {
    return unwrap(await api.patch(`/garage/controllers/${controllerId}/password`, { password }));
  },

  async revokeControllerSessions(controllerId) {
    return unwrap(await api.post(`/garage/controllers/${controllerId}/revoke-sessions`));
  },

  async deleteController(controllerId) {
    return unwrap(await api.delete(`/garage/controllers/${controllerId}`));
  },

  async getControllerDashboard() {
    return unwrap(await api.get("/garage/controller/dashboard"));
  },

  async setControllerAvailability(availability) {
    return unwrap(await api.patch("/garage/controller/availability", { availability }));
  },

  async transferControllerBooking(bookingId, controllerId) {
    return unwrap(await api.post(`/garage/controllers/bookings/${bookingId}/transfer`, { controllerId }));
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

  async requestDeleteAccountOtp() {
    return unwrap(await api.post("/garages/me/delete-otp"));
  },

  async deleteAccount(payload = {}) {
    return unwrap(await api.delete("/garages/me", { data: payload }));
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

  async deletePhoto(...args) {
    // New: deletePhoto(garageId, imageId)
    const [garageId, imageId] = args.slice(-2);
    const garage = unwrap(
      await api.delete(`/garages/${garageId}/media/${imageId}`),
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

  async getRequest(...args) {
    // New: getRequest(requestIdOrBookingId)
    const requestId = args.at(-1);
    const request = unwrap(await api.get(`/garage/requests/${requestId}`));
    return mapGarageRequestToBooking(request);
  },

  async acceptRequest(...args) {
    // New: acceptRequest(requestId, note)
    // Compatibility: acceptRequest(token, requestId, note)
    const normalizedArgs = args[0] === "cookie-session" ? args.slice(1) : args;
    const [requestId, note = ""] = normalizedArgs.slice(-2);

    const request = unwrap(
      await api.post(`/garage/requests/${requestId}/accept`, {
        note,
      }),
    );

    return mapGarageRequestToBooking(request);
  },

  async rejectRequest(...args) {
    // New: rejectRequest(requestId, note)
    // Compatibility: rejectRequest(token, requestId, note)
    const normalizedArgs = args[0] === "cookie-session" ? args.slice(1) : args;
    const [requestId, note = ""] = normalizedArgs.slice(-2);

    const request = unwrap(
      await api.post(`/garage/requests/${requestId}/reject`, {
        note,
      }),
    );

    return mapGarageRequestToBooking(request);
  },

  async verifyHandoverOtp(...args) {
    // New: verifyHandoverOtp(requestId, otp, images, video)
    const [requestId, otp, images = [], video = null] = args.slice(-4);

    const formData = new FormData();
    formData.append("otp", otp);

    images
      .map((item) => item.file || item)
      .filter(Boolean)
      .forEach((file) => formData.append("images", file));

    const videoFile = video?.file || video;
    if (videoFile) formData.append("video", videoFile);

    return unwrap(
      await api.post(
        `/garage/requests/${requestId}/verify-handover-otp`,
        formData,
      ),
    );
  },

  async markDelivered(...args) {
    // New: markDelivered(requestId, images, video)
    // Compatibility: markDelivered(token, requestId, images, video)
    const normalizedArgs = args[0] === "cookie-session" ? args.slice(1) : args;
    const [requestId, images = [], video = null] = normalizedArgs.slice(-3);

    const formData = new FormData();

    images
      .map((item) => item.file || item)
      .filter(Boolean)
      .forEach((file) => formData.append("images", file));

    const videoFile = video?.file || video;
    if (videoFile) formData.append("video", videoFile);

    return unwrap(
      await api.post(
        `/garage/requests/${requestId}/mark-delivered`,
        formData,
      ),
    );
  },
};
