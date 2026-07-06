import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const reviewApi = {
  async create(payload) {
    return unwrap(await api.post("/reviews", payload));
  },

  async update(reviewId, payload) {
    return unwrap(await api.patch(`/reviews/${reviewId}`, payload));
  },

  async remove(reviewId) {
    return unwrap(await api.delete(`/reviews/${reviewId}`));
  },

  async getMine() {
    return unwrap(await api.get("/reviews/my"));
  },
};
