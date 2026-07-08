const PLATFORM_FEE_BRACKETS = Object.freeze([
  { upperExclusive: 1000, fee: 49 },
  { upperExclusive: 5000, fee: 99 },
  { upperExclusive: 20000, fee: 249 },
  { upperExclusive: Infinity, fee: 500 },
]);

export const calculatePlatformFee = (serviceUpperLimit = 0) => {
  const amount = Number(serviceUpperLimit);
  const normalizedAmount =
    Number.isFinite(amount) && amount > 0 ? amount : 0;

  if (normalizedAmount <= 0) return 0;

  return PLATFORM_FEE_BRACKETS.find(
    ({ upperExclusive }) => normalizedAmount < upperExclusive,
  ).fee;
};
