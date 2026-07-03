export const DEFAULT_SERVICE_RANGE_DELTA = 500;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const getServiceMinPrice = (service = {}) =>
  toNumber(
    service.priceRange?.min ??
      service.estimatedMinPrice ??
      service.basePrice ??
      service.minPrice ??
      service.price,
    0,
  );

export const getServiceMaxPrice = (service = {}) => {
  const min = getServiceMinPrice(service);
  const explicitMax =
    service.priceRange?.max ?? service.estimatedMaxPrice ?? service.maxPrice;

  if (explicitMax !== undefined && explicitMax !== null) {
    return toNumber(explicitMax, min + DEFAULT_SERVICE_RANGE_DELTA);
  }

  return min + DEFAULT_SERVICE_RANGE_DELTA;
};

export const getServicePriceRange = (service = {}) => {
  const min = getServiceMinPrice(service);
  const max = getServiceMaxPrice(service);

  return { min, max, label: `₹${min} - ₹${max}` };
};

export const formatServicePriceRange = (service = {}) => {
  const { min, max } = getServicePriceRange(service);
  return min === max ? `₹${min}` : `₹${min} - ₹${max}`;
};
