import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const adminApi = {
  async login(identifier, password) {
    const result = unwrap(await api.post("/auth/login", { identifier, password, role: "ADMIN" }));
    if (result.user?.role !== "ADMIN") {
      throw new Error("This account is not an admin account");
    }
    return result;
  },

  async getApplications(status = "") {
    return unwrap(await api.get("/admin/garage-applications", {
      params: status ? { status } : {},
    }));
  },

  async approveApplication(applicationId, adminNote = "") {
    return unwrap(await api.post(`/admin/garage-applications/${applicationId}/approve`, { adminNote }));
  },

  async requestApplicationChanges(applicationId, adminNote = "") {
    return unwrap(await api.post(`/admin/garage-applications/${applicationId}/request-changes`, { adminNote }));
  },

  async denyApplication(applicationId, adminNote = "") {
    return unwrap(await api.post(`/admin/garage-applications/${applicationId}/deny`, { adminNote }));
  },

  async deleteApplications(applicationIds = []) {
    return unwrap(await api.delete("/admin/garage-applications", { data: { applicationIds } }));
  },

  async getGarages(params = {}) {
    return unwrap(await api.get("/admin/garages", { params }));
  },

  async getGarage(garageId) {
    return unwrap(await api.get(`/admin/garages/${garageId}`));
  },

  async deleteGarages(garageIds = []) {
    return unwrap(await api.delete("/admin/garages", { data: { garageIds } }));
  },

  async getAssignableServices(params = {}) {
    return unwrap(await api.get("/admin/garages/services", { params }));
  },

  async saveGarageService(garageId, payload) {
    return unwrap(await api.post(`/admin/garages/${garageId}/services`, payload));
  },

  async removeGarageService(garageId, serviceId) {
    return unwrap(await api.delete(`/admin/garages/${garageId}/services/${serviceId}`));
  },

  async getPriceRanges(params = {}) {
    return unwrap(await api.get("/admin/city-service-price-ranges", { params }));
  },

  async getCustomers(params = {}) {
    return unwrap(await api.get("/admin/customers", { params }));
  },

  async getBookings(params = {}) {
    return unwrap(await api.get("/admin/bookings", { params }));
  },

  async sendNotification(payload) {
    return unwrap(await api.post("/admin/notifications", payload));
  },

  async createPriceRange(payload) {
    return unwrap(await api.post("/admin/city-service-price-ranges", payload));
  },

  async updatePriceRange(id, payload) {
    return unwrap(await api.patch(`/admin/city-service-price-ranges/${id}`, payload));
  },

  async deletePriceRange(id) {
    return unwrap(await api.delete(`/admin/city-service-price-ranges/${id}`));
  },
};
