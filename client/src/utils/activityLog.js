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

export const addRecentActivity = ({ type = "SYSTEM", title, detail = "", path = "" }) => {
  if (!title) return;

  const activity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    detail,
    path,
    createdAt: new Date().toISOString(),
  };

  const next = [activity, ...getRecentActivities()].slice(0, MAX_ACTIVITIES);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("rov:activity", { detail: activity }));
};
