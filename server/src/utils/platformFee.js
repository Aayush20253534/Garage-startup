const PLATFORM_FEE_BRACKETS = Object.freeze([
  { upperExclusive: 1000, fee: 49 },
  { upperExclusive: 5000, fee: 99 },
  { upperExclusive: 20000, fee: 249 },
  { upperExclusive: Infinity, fee: 500 },
]);

/**
 * Calculates the normal booking platform fee from the service price upper limit.
 *
 * Examples:
 * - Rs. 100 - Rs. 999   => Rs. 49
 * - Rs. 100 - Rs. 1,200 => Rs. 99 (uses the upper limit)
 * - Rs. 5,000 - Rs. 8,000 => Rs. 249
 */
const calculatePlatformFee = (serviceUpperLimit) => {
  const parsedAmount = Number(serviceUpperLimit);
  const amount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  return PLATFORM_FEE_BRACKETS.find(
    ({ upperExclusive }) => amount < upperExclusive,
  ).fee;
};

module.exports = {
  PLATFORM_FEE_BRACKETS,
  calculatePlatformFee,
};
