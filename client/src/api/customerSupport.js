import api from "@/api/axios";
import { verifyCurrentSession } from "@/utils/authSession";

const unwrap = (response) => response.data?.data ?? response.data;

export const customerSupportApi = {
  async login(email, password) {
    const result = unwrap(
      await api.post("/auth/support/login", {
        identifier: email,
        password,
        role: "CUSTOMER_SUPPORT",
      }),
    );

    if (!result?.requiresTwoFactor || !result?.challengeId) {
      throw new Error("Support two-factor verification could not be started");
    }

    return result;
  },

  async verifyLoginOtp(challengeId, otp) {
    const result = unwrap(
      await api.post(
        "/auth/staff/verify-otp",
        { challengeId, otp },
        { sessionScope: "support" },
      ),
    );

    if (result.user?.role !== "CUSTOMER_SUPPORT") {
      throw new Error("This account is not a customer support account");
    }

    const user = await verifyCurrentSession({
      expectedRole: "CUSTOMER_SUPPORT",
      portal: "support",
    });
    return { ...result, user };
  },

  async resendLoginOtp(challengeId) {
    return unwrap(
      await api.post(
        "/auth/staff/resend-otp",
        { challengeId },
        { sessionScope: "support" },
      ),
    );
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

  async getNotifies() {
    return unwrap(await api.get("/customer-support/notify"));
  },

  async markNotifyRead(notificationId) {
    return unwrap(
      await api.patch(`/customer-support/notify/${notificationId}/read`),
    );
  },

  async markAllNotifiesRead() {
    return unwrap(await api.patch("/customer-support/notify/read-all"));
  },

  // Compatibility aliases for older components.
  async getNotifications() {
    return this.getNotifies();
  },

  async markNotificationRead(notificationId) {
    return this.markNotifyRead(notificationId);
  },

  async markAllNotificationsRead() {
    return this.markAllNotifiesRead();
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
