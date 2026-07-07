import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

let configPromise = null;

export const mapsApi = {
  getConfig() {
    if (!configPromise) {
      configPromise = api
        .get("/maps/config")
        .then(unwrap)
        .catch((error) => {
          configPromise = null;
          throw error;
        });
    }
    return configPromise;
  },

  async autocomplete({ input, sessionToken, latitude, longitude }) {
    return unwrap(
      await api.post("/maps/autocomplete", {
        input,
        sessionToken,
        ...(Number.isFinite(Number(latitude)) && { latitude: Number(latitude) }),
        ...(Number.isFinite(Number(longitude)) && { longitude: Number(longitude) }),
      }),
    );
  },

  async validateAddress(payload) {
    return unwrap(await api.post("/maps/validate-address", payload));
  },

  async getPlaceDetails(placeId, sessionToken) {
    return unwrap(
      await api.get(`/maps/places/${encodeURIComponent(placeId)}`, {
        params: sessionToken ? { sessionToken } : {},
      }),
    );
  },

  async computeRoute(origin, destination, options = {}) {
    return unwrap(
      await api.post("/maps/route", {
        origin,
        destination,
        trafficAware: options.trafficAware ?? true,
        alternatives: options.alternatives ?? false,
      }),
    );
  },

  async computeRouteMatrix(origins, destinations, options = {}) {
    return unwrap(
      await api.post("/maps/route-matrix", {
        origins,
        destinations,
        trafficAware: options.trafficAware ?? true,
      }),
    );
  },

  async snapToRoads(points, interpolate = true) {
    return unwrap(
      await api.post("/maps/roads/snap", {
        points,
        interpolate,
      }),
    );
  },

  async getBookingTracking(bookingId) {
    return unwrap(await api.get(`/maps/bookings/${bookingId}/tracking`));
  },

  async startBookingTracking(bookingId) {
    return unwrap(await api.post(`/maps/bookings/${bookingId}/tracking/start`));
  },

  async updateBookingTracking(bookingId, point) {
    return unwrap(
      await api.post(`/maps/bookings/${bookingId}/tracking/location`, point),
    );
  },

  async stopBookingTracking(bookingId) {
    return unwrap(await api.post(`/maps/bookings/${bookingId}/tracking/stop`));
  },

  async optimizeRoutes(bookingIds = []) {
    return unwrap(
      await api.post("/maps/optimize-routes", {
        bookingIds,
      }),
    );
  },
};
