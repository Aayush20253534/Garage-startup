const toNonNegativeWholeRupee = (value) => {
  const amount = Math.round(Number(value));

  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const getStoredPaymentSplit = (payment) => ({
  walletAmountUsed: toNonNegativeWholeRupee(payment?.walletAmountUsed),
  upiAmountPaid: toNonNegativeWholeRupee(payment?.upiAmountPaid),
});

const isSamePaymentSplit = (payment, split) => {
  const stored = getStoredPaymentSplit(payment);

  return (
    stored.walletAmountUsed ===
      toNonNegativeWholeRupee(split?.walletAmountUsed) &&
    stored.upiAmountPaid === toNonNegativeWholeRupee(split?.upiAmountPaid)
  );
};

module.exports = {
  getStoredPaymentSplit,
  isSamePaymentSplit,
  toNonNegativeWholeRupee,
};
