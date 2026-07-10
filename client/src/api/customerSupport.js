import api from "@/api/axios";
import { verifyCurrentSession } from "@/utils/authSession";

const unwrap = (response) => response.data?.data ?? response.data;

export const customerSupportApi = {
  async login(email, password) {
    const result = unwrap(
      await api.post("/auth/login", {
        identifier: email,
        password,
        role: "CUSTOMER_SUPPORT",
      }),
    );

    if (result.user?.role !== "CUSTOMER_SUPPORT") {
      throw new Error("This account is not a customer support account");
    }

    const user = await verifyCurrentSession({ expectedRole: "CUSTOMER_SUPPORT" });
    return { ...result, user };
  },

  async getDashboard() {
    return unwrap(await api.get("/customer-support/dashboard"));
  },

  async getTickets(params = {}) {
    return unwrap(await api.get("/customer-support/tickets", { params }));
  },

  async getTicket(ticketId) {
    return unwrap(await api.get(`/customer-support/tickets/${ticketId}`));
  },

  async claimTicket(ticketId) {
    return unwrap(await api.post(`/customer-support/tickets/${ticketId}/claim`));
  },

  async releaseTicket(ticketId) {
    return unwrap(await api.post(`/customer-support/tickets/${ticketId}/release`));
  },

  async replyToTicket(ticketId, payload) {
    return unwrap(
      await api.post(`/customer-support/tickets/${ticketId}/replies`, payload),
    );
  },

  async updateTicket(ticketId, payload) {
    return unwrap(await api.patch(`/customer-support/tickets/${ticketId}`, payload));
  },

  async sendCustomerNotification(payload) {
    return unwrap(await api.post("/customer-support/notifications/send", payload));
  },

  async getNotifications() {
    return unwrap(await api.get("/customer-support/notifications"));
  },

  async markNotificationRead(notificationId) {
    return unwrap(
      await api.patch(`/customer-support/notifications/${notificationId}/read`),
    );
  },

  async markAllNotificationsRead() {
    return unwrap(await api.patch("/customer-support/notifications/read-all"));
  },

  async searchEmailUsers(params = {}) {
    return unwrap(await api.get("/customer-support/email-users", { params }));
  },

  async sendUserEmail(payload) {
    return unwrap(await api.post("/customer-support/emails", payload));
  },

  async getEmailHistory() {
    return unwrap(await api.get("/customer-support/emails/history"));
  },
};
