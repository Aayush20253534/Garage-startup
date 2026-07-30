const normalizeCity = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

/**
 * Service prices vary by vehicle and city. Exact address fields can be
 * hydrated or normalized in the background without changing the applicable
 * price catalogue, so they must not invalidate a customer's selected items.
 */
export const getCartPricingContextKey = (
  selectedVehicle,
  selectedLocation,
) =>
  JSON.stringify({
    vehicleId: selectedVehicle?.id || null,
    city: normalizeCity(selectedLocation?.city) || null,
  });


const PENDING_SERVICE_SELECTION_KEY = "rov_pending_service_selection";
const PENDING_SERVICE_SELECTION_TTL_MS = 30 * 60 * 1000;

const getSessionStorage = () => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const savePendingServiceSelection = ({
  serviceId,
  categoryId,
  returnLocation,
}) => {
  const storage = getSessionStorage();
  if (!storage || !serviceId) return;

  storage.setItem(
    PENDING_SERVICE_SELECTION_KEY,
    JSON.stringify({
      serviceId,
      categoryId: categoryId || null,
      returnLocation: returnLocation || null,
      createdAt: Date.now(),
    }),
  );
};

export const readPendingServiceSelection = () => {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const value = JSON.parse(
      storage.getItem(PENDING_SERVICE_SELECTION_KEY) || "null",
    );

    if (!value?.serviceId) return null;

    if (
      !Number.isFinite(Number(value.createdAt)) ||
      Date.now() - Number(value.createdAt) > PENDING_SERVICE_SELECTION_TTL_MS
    ) {
      storage.removeItem(PENDING_SERVICE_SELECTION_KEY);
      return null;
    }

    return value;
  } catch {
    storage.removeItem(PENDING_SERVICE_SELECTION_KEY);
    return null;
  }
};

export const clearPendingServiceSelection = () => {
  getSessionStorage()?.removeItem(PENDING_SERVICE_SELECTION_KEY);
};
