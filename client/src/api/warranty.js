import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

const warrantyApi = {
  async listMyWarranties() {
    return unwrap(await api.get("/warranties"));
  },
};

export default warrantyApi;
