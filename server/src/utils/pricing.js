const DEFAULT_SERVICE_RANGE_DELTA = 500;

const getServiceCurrentPrice = (service) => {
  const value = service?.basePrice ?? service?.minPrice ?? service?.maxPrice ?? 0;
  return Number(value) || 0;
};

const getServicePriceRange = (service, options = {}) => {
  const lower = Number(service?.minPrice ?? getServiceCurrentPrice(service)) || 0;
  const explicitMax = Number(service?.maxPrice);
  if (Number.isFinite(explicitMax) && explicitMax >= lower) {
    return {
      min: lower,
      max: explicitMax,
      label: `Rs. ${lower} - Rs. ${explicitMax}`,
    };
  }

  const delta = Number(options.delta ?? process.env.SERVICE_PRICE_RANGE_DELTA ?? DEFAULT_SERVICE_RANGE_DELTA);
  const upper = lower + (Number.isFinite(delta) ? delta : DEFAULT_SERVICE_RANGE_DELTA);

  return {
    min: lower,
    max: upper,
    label: `Rs. ${lower} - Rs. ${upper}`,
  };
};

const addServicePriceRange = (service) => ({
  ...service,
  priceRange: getServicePriceRange(service),
});

const sumServiceRanges = (services = []) => {
  return services.reduce(
    (total, service) => {
      const range = getServicePriceRange(service);
      return {
        min: total.min + range.min,
        max: total.max + range.max,
      };
    },
    { min: 0, max: 0 }
  );
};

module.exports = {
  DEFAULT_SERVICE_RANGE_DELTA,
  addServicePriceRange,
  getServiceCurrentPrice,
  getServicePriceRange,
  sumServiceRanges,
};
