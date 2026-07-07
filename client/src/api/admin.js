import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const adminApi = {
  async login(identifier, password) {
    const result = unwrap(
      await api.post("/auth/login", { identifier, password, role: "ADMIN" }),
    );
    if (result.user?.role !== "ADMIN") {
      throw new Error("This account is not an admin account");
    }
    return result;
  },

  async getStats() {
    return unwrap(await api.get("/admin/stats"));
  },

  async getApplications(status = "") {
    return unwrap(
      await api.get("/admin/garage-applications", {
        params: status ? { status } : {},
      }),
    );
  },

  async approveApplication(applicationId, adminNote = "") {
    return unwrap(
      await api.post(`/admin/garage-applications/${applicationId}/approve`, {
        adminNote,
      }),
    );
  },

  async requestApplicationChanges(applicationId, adminNote = "") {
    return unwrap(
      await api.post(
        `/admin/garage-applications/${applicationId}/request-changes`,
        { adminNote },
      ),
    );
  },

  async denyApplication(applicationId, adminNote = "") {
    return unwrap(
      await api.post(`/admin/garage-applications/${applicationId}/deny`, {
        adminNote,
      }),
    );
  },

  async deleteApplications(applicationIds = []) {
    return unwrap(
      await api.delete("/admin/garage-applications", {
        data: { applicationIds },
      }),
    );
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
    return unwrap(
      await api.post(`/admin/garages/${garageId}/services`, payload),
    );
  },

  async removeGarageService(garageId, serviceId, params = {}) {
    return unwrap(
      await api.delete(`/admin/garages/${garageId}/services/${serviceId}`, {
        params,
      }),
    );
  },

  async getPriceRanges(params = {}) {
    return unwrap(
      await api.get("/admin/city-service-price-ranges", { params }),
    );
  },

  async getCustomers(params = {}) {
    return unwrap(await api.get("/admin/customers", { params }));
  },

  async getBookings(params = {}) {
    return unwrap(await api.get("/admin/bookings", { params }));
  },


  async clearAllBookings(confirmation) {
    return unwrap(
      await api.delete("/admin/bookings/all", {
        data: { confirmation },
      }),
    );
  },

  async sendNotification(payload) {
    return unwrap(await api.post("/admin/notifications", payload));
  },

  async searchEmailUsers(params = {}) {
    return unwrap(await api.get("/admin/email-users", { params }));
  },

  async sendUserEmail(payload) {
    return unwrap(await api.post("/admin/emails", payload));
  },

  async createPriceRange(payload) {
    return unwrap(await api.post("/admin/city-service-price-ranges", payload));
  },

  async updatePriceRange(id, payload) {
    return unwrap(
      await api.patch(`/admin/city-service-price-ranges/${id}`, payload),
    );
  },

  async deletePriceRange(id) {
    return unwrap(await api.delete(`/admin/city-service-price-ranges/${id}`));
  },

  async getCarBrands(params = {}) {
    return unwrap(await api.get("/admin/cars/brands", { params }));
  },

  async createCarBrand(payload) {
    return unwrap(await api.post("/admin/cars/brands", payload));
  },

  async updateCarBrand(brandId, payload) {
    return unwrap(await api.patch(`/admin/cars/brands/${brandId}`, payload));
  },

  async deleteCarBrand(brandId) {
    return unwrap(await api.delete(`/admin/cars/brands/${brandId}`));
  },

  async createCarModel(brandId, payload) {
    return unwrap(
      await api.post(`/admin/cars/brands/${brandId}/models`, payload),
    );
  },

  async updateCarModel(modelId, payload) {
    return unwrap(await api.patch(`/admin/cars/models/${modelId}`, payload));
  },

  async deleteCarModel(modelId) {
    return unwrap(await api.delete(`/admin/cars/models/${modelId}`));
  },

  async getServiceCategories(params = {}) {
    return unwrap(await api.get("/admin/services/categories", { params }));
  },

  async createServiceCategory(payload) {
    return unwrap(await api.post("/admin/services/categories", payload));
  },

  async updateServiceCategory(categoryId, payload) {
    return unwrap(
      await api.patch(`/admin/services/categories/${categoryId}`, payload),
    );
  },

  async deleteServiceCategory(categoryId) {
    return unwrap(await api.delete(`/admin/services/categories/${categoryId}`));
  },

  async uploadServiceCategoryThumbnail(categoryId, payload) {
    return unwrap(
      await api.post(`/admin/services/categories/${categoryId}/thumbnail`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },

  async createService(payload) {
    return unwrap(await api.post("/admin/services", payload));
  },

  async updateService(serviceId, payload) {
    return unwrap(await api.patch(`/admin/services/${serviceId}`, payload));
  },

  async deleteService(serviceId) {
    return unwrap(await api.delete(`/admin/services/${serviceId}`));
  },

  async uploadServiceThumbnail(serviceId, payload) {
    return unwrap(
      await api.post(`/admin/services/${serviceId}/thumbnail`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },

  async getSystemIssues(params = {}) {
    return unwrap(
      await api.get("/admin/system-issues", {
        params,
        skipErrorReporting: true,
      }),
    );
  },

  async getSystemIssueStats(config = {}) {
    return unwrap(
      await api.get("/admin/system-issues/stats", {
        skipErrorReporting: true,
        ...config,
      }),
    );
  },

  async getSystemIssue(issueId) {
    return unwrap(
      await api.get(`/admin/system-issues/${issueId}`, {
        skipErrorReporting: true,
      }),
    );
  },

  async updateSystemIssueStatus(issueId, payload) {
    return unwrap(
      await api.patch(`/admin/system-issues/${issueId}/status`, payload, {
        skipErrorReporting: true,
      }),
    );
  },

  async deleteSystemIssue(issueId) {
    return unwrap(
      await api.delete(`/admin/system-issues/${issueId}`, {
        skipErrorReporting: true,
      }),
    );
  },

  async clearResolvedSystemIssues() {
    return unwrap(
      await api.delete("/admin/system-issues/resolved", {
        skipErrorReporting: true,
      }),
    );
  },
};
