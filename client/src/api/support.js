import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const supportApi = {
  async listTickets() {
    return unwrap(await api.get("/support-tickets/my"));
  },

  async getTicket(ticketId) {
    return unwrap(await api.get(`/support-tickets/${ticketId}`));
  },

  async getBookings() {
    return unwrap(await api.get("/support-tickets/bookings"));
  },

  async createTicket(payload) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (key === "images") return;
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, value);
      }
    });
    (payload.images || []).forEach((file) => formData.append("images", file));

    return unwrap(
      await api.post("/support-tickets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
  },

  async reply(ticketId, body) {
    return unwrap(
      await api.post(`/support-tickets/${ticketId}/replies`, { body }),
    );
  },

  async close(ticketId) {
    return unwrap(await api.patch(`/support-tickets/${ticketId}/close`));
  },
};

export default supportApi;
