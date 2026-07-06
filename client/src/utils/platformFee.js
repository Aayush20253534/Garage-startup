export const PLATFORM_FEE_BRACKETS = Object.freeze([
  { upperExclusive: 1000, fee: 49 },
  { upperExclusive: 5000, fee: 99 },
  { upperExclusive: 20000, fee: 249 },
  { upperExclusive: Infinity, fee: 500 },
]);

/**
 * Calculates the platform fee using the upper limit of the selected
 * service price range, not its lower limit.
 */
export const calculatePlatformFee = (serviceUpperLimit) => {
  const parsedAmount = Number(serviceUpperLimit);
  const amount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  return PLATFORM_FEE_BRACKETS.find(
    ({ upperExclusive }) => amount < upperExclusive,
  ).fee;
};
