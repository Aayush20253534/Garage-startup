export const DEFAULT_SERVICE_RANGE_DELTA = 500;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const formatRupees = (value = 0) =>
  `\u20b9${toNumber(value, 0).toLocaleString("en-IN")}`;

export const formatRupeeRange = (minValue = 0, maxValue = minValue) => {
  const min = toNumber(minValue, 0);
  const max = toNumber(maxValue, min);

  return min === max
    ? formatRupees(max)
    : `${formatRupees(min)} - ${formatRupees(max)}`;
};

export const getServiceMinPrice = (service = {}) =>
  toNumber(
    service.priceRange?.min ??
      service.estimatedMinPrice ??
      service.minPrice ??
      service.basePrice ??
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

  return { min, max, label: formatRupeeRange(min, max) };
};

export const formatServicePriceRange = (service = {}) => {
  const { min, max } = getServicePriceRange(service);
  return formatRupeeRange(min, max);
};
