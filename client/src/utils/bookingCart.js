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
