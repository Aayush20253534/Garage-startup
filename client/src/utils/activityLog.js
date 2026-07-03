import api from "@/api/axios";

const ACTIVITY_KEY = "rov_recent_activity";
const MAX_ACTIVITIES = 20;

export const getRecentActivities = () => {
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const addRecentActivity = ({
  type = "SYSTEM",
  title,
  detail = "",
  path = "",
  metadata,
}) => {
  if (!title) return;

  const activity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    detail,
    path,
    metadata,
    createdAt: new Date().toISOString(),
  };

  const next = [activity, ...getRecentActivities()].slice(0, MAX_ACTIVITIES);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("rov:activity", { detail: activity }));

  api
    .post("/activities", {
      type,
      title,
      detail,
      path,
      metadata,
    })
    .catch(() => {});

  return activity;
};

export const fetchRecentActivities = async (limit = MAX_ACTIVITIES) => {
  try {
    const response = await api.get("/activities", { params: { limit } });
    const activities = response.data?.data || [];
    const safeActivities = Array.isArray(activities) ? activities : [];

    localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify(safeActivities.slice(0, MAX_ACTIVITIES)),
    );

    window.dispatchEvent(new CustomEvent("rov:activity-sync"));

    return safeActivities;
  } catch {
    return getRecentActivities();
  }
};
