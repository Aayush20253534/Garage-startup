import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const cityApi = {
  async getCities(params = {}) {
    return unwrap(await api.get("/cities", { params }));
  },

  async getAdminCities(params = {}) {
    return unwrap(await api.get("/cities/admin", { params }));
  },

  async createCity(payload) {
    return unwrap(await api.post("/cities/admin", payload));
  },

  async updateCity(cityId, payload) {
    return unwrap(await api.patch(`/cities/admin/${cityId}`, payload));
  },
};
