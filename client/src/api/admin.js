import api from "@/api/axios";
import { verifyCurrentSession } from "@/utils/authSession";

const unwrap = (response) => response.data?.data ?? response.data;

export const adminApi = {
  async login(identifier, password) {
    const result = unwrap(
      await api.post("/auth/login", { identifier, password, role: "ADMIN" }),
    );

    if (!result?.requiresTwoFactor || !result?.challengeId) {
      throw new Error("Admin two-factor verification could not be started");
    }

    return result;
  },

  async verifyLoginOtp(challengeId, otp) {
    const result = unwrap(
      await api.post("/auth/staff/verify-otp", { challengeId, otp }),
    );

    if (result.user?.role !== "ADMIN") {
      throw new Error("This account is not an admin account");
    }

    const user = await verifyCurrentSession({ expectedRole: "ADMIN" });
    return { ...result, user };
  },

  async resendLoginOtp(challengeId) {
    return unwrap(
      await api.post("/auth/staff/resend-otp", { challengeId }),
    );
  },

  async getStats() {
    return unwrap(await api.get("/admin/stats"));
  },

  async getOperations() {
    return unwrap(await api.get("/admin/operations"));
  },

  async getControlCenterOverview() {
    return unwrap(await api.get("/admin/control-center/overview"));
  },

  async getAuditLogs(params = {}) {
    return unwrap(await api.get("/admin/control-center/audit-logs", { params }));
  },

  async searchSupportBookings(search) {
    return unwrap(await api.get("/admin/control-center/support-bookings", { params: { search } }));
  },

  async resendBookingNotification(bookingId, payload) {
    return unwrap(await api.post(`/admin/control-center/support-bookings/${bookingId}/notify`, payload));
  },

  async getGaragePerformance(params = {}) {
    return unwrap(await api.get("/admin/control-center/garages/performance", { params }));
  },

  async setGarageOperationalStatus(garageId, payload) {
    return unwrap(await api.patch(`/admin/control-center/garages/${garageId}/operational-status`, payload));
  },

  async getEscalations(params = {}) {
    return unwrap(await api.get("/admin/control-center/escalations", { params }));
  },

  async updateEscalation(id, payload) {
    return unwrap(await api.patch(`/admin/control-center/escalations/${id}`, payload));
  },

  async getEscalationRules() {
    return unwrap(await api.get("/admin/control-center/escalation-rules"));
  },

  async updateEscalationRule(id, payload) {
    return unwrap(await api.patch(`/admin/control-center/escalation-rules/${id}`, payload));
  },

  async getPricingCoverage() {
    return unwrap(await api.get("/admin/control-center/pricing/coverage"));
  },

  async exportPriceRangesCsv() {
    return api.get("/admin/control-center/pricing/export", { responseType: "blob" });
  },

  async importPriceRanges(rows, dryRun = false) {
    return unwrap(await api.post("/admin/control-center/pricing/import", { rows, dryRun }));
  },

  async getPriceSchedules(params = {}) {
    return unwrap(await api.get("/admin/control-center/pricing/schedules", { params }));
  },

  async createPriceSchedule(payload) {
    return unwrap(await api.post("/admin/control-center/pricing/schedules", payload));
  },

  async cancelPriceSchedule(id) {
    return unwrap(await api.patch(`/admin/control-center/pricing/schedules/${id}/cancel`));
  },

  async getAvailabilityRules(params = {}) {
    return unwrap(await api.get("/admin/control-center/availability-rules", { params }));
  },

  async createAvailabilityRule(payload) {
    return unwrap(await api.post("/admin/control-center/availability-rules", payload));
  },

  async updateAvailabilityRule(id, payload) {
    return unwrap(await api.patch(`/admin/control-center/availability-rules/${id}`, payload));
  },

  async deleteAvailabilityRule(id) {
    return unwrap(await api.delete(`/admin/control-center/availability-rules/${id}`));
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

  async setGarageActiveStatus(garageId, isActive) {
    return unwrap(
      await api.patch(`/admin/garages/${garageId}/status`, { isActive }),
    );
  },

  async updateGarage(garageId, payload) {
    return unwrap(await api.patch(`/admin/garages/${garageId}`, payload));
  },

  async uploadGaragePhotos(garageId, files = []) {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    return unwrap(await api.post(`/garages/${garageId}/media`, formData));
  },

  async deleteGaragePhoto(garageId, imageId) {
    return unwrap(await api.delete(`/garages/${garageId}/media/${imageId}`));
  },

  async deleteGaragePhotos(garageId, imageIds = []) {
    return unwrap(
      await api.delete(`/garages/${garageId}/media`, { data: { imageIds } }),
    );
  },

  async setGarageThumbnail(garageId, imageId) {
    return unwrap(await api.patch(`/admin/garages/${garageId}/images/${imageId}/thumbnail`));
  },

  async reorderGaragePhotos(garageId, imageIds) {
    return unwrap(await api.patch(`/admin/garages/${garageId}/images/order`, { imageIds }));
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

  async getPriceRangeSubmissions(params = {}) {
    return unwrap(
      await api.get("/admin/city-service-price-ranges/submissions", { params }),
    );
  },

  async getCustomers(params = {}) {
    return unwrap(await api.get("/admin/customers", { params }));
  },

  async deleteCustomers(customerIds = []) {
    return unwrap(
      await api.delete("/admin/customers", { data: { customerIds } }),
    );
  },

  async setCustomerActiveStatus(userId, isActive) {
    return unwrap(
      await api.patch(`/admin/customers/${userId}/status`, { isActive }),
    );
  },

  async getCustomerProfile(userId) {
    return unwrap(await api.get(`/admin/customers/${userId}/profile`));
  },

  async getBookings(params = {}) {
    return unwrap(await api.get("/admin/bookings", { params }));
  },

  async getBooking(bookingId) {
    return unwrap(await api.get(`/admin/bookings/${bookingId}`));
  },

  async updateBookingStatus(bookingId, payload) {
    return unwrap(await api.patch(`/admin/bookings/${bookingId}/status`, payload));
  },

  async reassignBookingGarage(bookingId, payload) {
    return unwrap(await api.patch(`/admin/bookings/${bookingId}/garage`, payload));
  },

  async addBookingNote(bookingId, note) {
    return unwrap(await api.post(`/admin/bookings/${bookingId}/notes`, { note }));
  },

  async getSupportTickets(params = {}) {
    return unwrap(await api.get("/admin/support-tickets", { params }));
  },

  async getSupportTicket(ticketId) {
    return unwrap(await api.get(`/admin/support-tickets/${ticketId}`));
  },

  async updateSupportTicket(ticketId, payload) {
    return unwrap(await api.patch(`/admin/support-tickets/${ticketId}`, payload));
  },

  async replyToSupportTicket(ticketId, payload) {
    return unwrap(
      await api.post(`/admin/support-tickets/${ticketId}/replies`, payload),
    );
  },

  async getSupportStaff() {
    return unwrap(await api.get("/admin/support-tickets/staff"));
  },

  async getCustomerSupportAccounts() {
    return unwrap(await api.get("/admin/customer-support-accounts"));
  },

  async createCustomerSupportAccount(payload) {
    return unwrap(await api.post("/admin/customer-support-accounts", payload));
  },

  async updateCustomerSupportAccount(accountId, payload) {
    return unwrap(
      await api.patch(`/admin/customer-support-accounts/${accountId}`, payload),
    );
  },

  async changeCustomerSupportPassword(accountId, password) {
    return unwrap(
      await api.patch(`/admin/customer-support-accounts/${accountId}/password`, {
        password,
      }),
    );
  },

  async getGarageControllers(garageId) {
    return unwrap(await api.get("/admin/garage-controllers", { params: { garageId } }));
  },

  async getGarageControllerActivity(controllerId, garageId) {
    return unwrap(await api.get(`/admin/garage-controllers/${controllerId}/activity`, { params: { garageId } }));
  },

  async createGarageController(garageId, payload) {
    return unwrap(await api.post(`/admin/garage-controllers/garage/${garageId}`, payload));
  },

  async updateGarageController(controllerId, garageId, payload) {
    return unwrap(await api.patch(`/admin/garage-controllers/${controllerId}`, { ...payload, garageId }));
  },

  async resetGarageControllerPassword(controllerId, garageId, password) {
    return unwrap(await api.patch(`/admin/garage-controllers/${controllerId}/password`, { garageId, password }));
  },

  async revokeGarageControllerSessions(controllerId, garageId) {
    return unwrap(await api.post(`/admin/garage-controllers/${controllerId}/revoke-sessions`, { garageId }));
  },

  async deleteGarageController(controllerId, garageId) {
    return unwrap(await api.delete(`/admin/garage-controllers/${controllerId}`, { data: { garageId } }));
  },

  async setGarageControllerLimit(garageId, limit) {
    return unwrap(await api.patch(`/admin/garage-controllers/garage/${garageId}/limit`, { limit }));
  },

  async transferGarageControllerBooking(bookingId, garageId, controllerId) {
    return unwrap(await api.post(`/admin/garage-controllers/bookings/${bookingId}/transfer`, { garageId, controllerId }));
  },

  async getInternAccounts() {
    return unwrap(await api.get("/admin/intern-accounts"));
  },

  async createInternAccount(payload) {
    return unwrap(await api.post("/admin/intern-accounts", payload));
  },

  async updateInternAccount(accountId, payload) {
    return unwrap(
      await api.patch(`/admin/intern-accounts/${accountId}`, payload),
    );
  },

  async changeInternPassword(accountId, password) {
    return unwrap(
      await api.patch(`/admin/intern-accounts/${accountId}/password`, {
        password,
      }),
    );
  },

  async getPayments(params = {}) {
    return unwrap(await api.get("/admin/payments", { params }));
  },

  async searchWalletTransferRecipients(params) {
    return unwrap(await api.get("/admin/wallet-transfers/recipients", { params }));
  },

  async transferWalletFunds(payload) {
    return unwrap(await api.post("/admin/wallet-transfers", payload));
  },

  async clearAllBookings(confirmation) {
    return unwrap(
      await api.delete("/admin/bookings/all", {
        data: { confirmation },
      }),
    );
  },

  async createPriceRange(payload) {
    return unwrap(await api.post("/admin/city-service-price-ranges", payload));
  },

  async reviewPriceRangeSubmission(id, payload) {
    return unwrap(
      await api.patch(
        `/admin/city-service-price-ranges/submissions/${id}/review`,
        payload,
      ),
    );
  },

  async approveAllPriceRangeSubmissions() {
    return unwrap(
      await api.post(
        "/admin/city-service-price-ranges/submissions/approve-all",
      ),
    );
  },

  async editPriceRangeSubmission(id, payload) {
    return unwrap(
      await api.patch(
        `/admin/city-service-price-ranges/submissions/${id}`,
        payload,
      ),
    );
  },

  async deletePriceRangeSubmission(id) {
    return unwrap(
      await api.delete(`/admin/city-service-price-ranges/submissions/${id}`),
    );
  },

  async deletePriceRangeSubmissions(status = null) {
    return unwrap(
      await api.delete("/admin/city-service-price-ranges/submissions", {
        data: { status },
      }),
    );
  },

  async updatePriceRange(id, payload) {
    return unwrap(
      await api.patch(`/admin/city-service-price-ranges/${id}`, payload),
    );
  },

  async deletePriceRange(id) {
    return unwrap(await api.delete(`/admin/city-service-price-ranges/${id}`));
  },

  async deletePriceRanges(
    priceRangeIds = [],
    deleteAll = false,
    confirmation = "",
    password = "",
  ) {
    return unwrap(
      await api.delete("/admin/city-service-price-ranges", {
        data: { priceRangeIds, deleteAll, confirmation, password },
      }),
    );
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

  async updatePopularServices(serviceIds) {
    return unwrap(await api.put("/admin/services/popular", { serviceIds }));
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

  async getDangerousCommands() {
    return unwrap(
      await api.get("/admin/dangerous/commands", {
        skipErrorReporting: true,
      }),
    );
  },

  async runDangerousCommand(command, payload = {}) {
    return unwrap(
      await api.post(`/admin/dangerous/commands/${command}/run`, payload, {
        skipErrorReporting: true,
      }),
    );
  },

  async downloadDangerousCommandFile(command, payload = {}) {
    return api.post(`/admin/dangerous/commands/${command}/download`, payload, {
      responseType: "blob",
      skipErrorReporting: true,
    });
  },
};
