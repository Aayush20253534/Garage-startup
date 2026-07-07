import api from "@/api/axios";
import { verifyCurrentSession } from "@/utils/authSession";

const unwrap = (response) => response.data?.data ?? response.data;

export const internApi = {
  async login(identifier, password) {
    const result = unwrap(
      await api.post("/auth/login", { identifier, password, role: "INTERN" }),
    );

    if (result.user?.role !== "INTERN") {
      throw new Error("This account is not an intern account");
    }

    const user = await verifyCurrentSession({ expectedRole: "INTERN" });
    return { ...result, user };
  },
};
