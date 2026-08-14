import api from "@/api/axios";

const unwrap = (response) => response.data?.data ?? response.data;

export const profileApi = {
  async uploadAvatar(file, { support = false } = {}) {
    if (!file) throw new Error("Profile picture is required");

    const formData = new FormData();
    formData.append("avatar", file);

    return unwrap(
      await api.post(
        support ? "/auth/support/profile/avatar" : "/auth/profile/avatar",
        formData,
        {
          timeout: 120000,
          sessionScope: support ? "support" : "main",
        },
      ),
    );
  },
};
