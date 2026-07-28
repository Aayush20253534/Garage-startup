import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const workerTaskApi = {
  async list(bookingId) {
    return unwrap(await api.get(`/garage/worker-tasks/booking/${bookingId}`));
  },

  async create(bookingId, payload) {
    return unwrap(await api.post(`/garage/worker-tasks/booking/${bookingId}`, payload));
  },

  async resend(taskId, payload = {}) {
    return unwrap(await api.post(`/garage/worker-tasks/${taskId}/resend`, payload));
  },

  async revoke(taskId) {
    return unwrap(await api.post(`/garage/worker-tasks/${taskId}/revoke`));
  },

  async getPublic(token) {
    return unwrap(await api.get(`/worker-tasks/${token}`, { skipNetworkRetry: true }));
  },

  async startTracking(token) {
    return unwrap(await api.post(`/worker-tasks/${token}/tracking/start`));
  },

  async sendLocation(token, payload) {
    return unwrap(await api.post(`/worker-tasks/${token}/tracking/location`, payload, {
      timeout: 15000,
      skipNetworkRetry: true,
    }));
  },

  async stopTracking(token) {
    return unwrap(await api.post(`/worker-tasks/${token}/tracking/stop`));
  },

  async completeHandoverJourney(token) {
    return unwrap(
      await api.post(`/worker-tasks/${token}/handover/complete-journey`),
    );
  },

  async verifyHandover(token, formData) {
    return unwrap(await api.post(`/worker-tasks/${token}/handover`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
      skipNetworkRetry: true,
    }));
  },

  async markDelivered(token, formData) {
    return unwrap(await api.post(`/worker-tasks/${token}/delivery`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
      skipNetworkRetry: true,
    }));
  },
};

export default workerTaskApi;
