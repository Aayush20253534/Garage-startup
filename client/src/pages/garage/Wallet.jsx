import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiX,
  FiCreditCard,
} from "react-icons/fi";
import { setWallet } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { formatRupees } from "@/utils/priceRange";
import { useApp } from "@/hooks/useApp";

const MINIMUM_RECHARGE_AMOUNT = 100;

const loadCashfreeCheckout = () =>
  new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Unable to load Cashfree checkout"));
    document.body.appendChild(script);
  });

const formatWalletDate = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

export default function GarageWallet() {
  const { wallet } = useSelector((state) => state.garage);
  const dispatch = useDispatch();
  const { garageToken, refreshGarage } = useApp();

  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [amount, setAmount] = useState(MINIMUM_RECHARGE_AMOUNT);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [cashfreeMode, setCashfreeMode] = useState("sandbox");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const transactions = useMemo(
    () => (Array.isArray(wallet?.transactions) ? wallet.transactions : []),
    [wallet?.transactions]
  );

  const balance = Number(wallet?.balance || 0);

  const minimumActivationAmount =
    wallet?.activation?.minimumActivationAmount ||
    wallet?.activation?.minimumBalance ||
    MINIMUM_RECHARGE_AMOUNT;

  const loadWallet = useCallback(async () => {
    if (!garageToken) return;

    setError("");

    try {
      const [walletData, txData] = await Promise.all([
        garageApi.getWallet(garageToken),
        garageApi.getWalletTransactions(garageToken),
      ]);

      dispatch(
        setWallet({
          ...(walletData.wallet || {}),
          balance: walletData.wallet?.balance || 0,
          activation: walletData.activation,
          transactions: txData.transactions || [],
        })
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load wallet");
    }
  }, [garageToken, dispatch]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const closeRechargeModal = () => {
    setShowRechargeModal(false);
    setPendingOrder(null);
    setError("");
  };

  const createRecharge = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const rechargeAmount = Number(amount);

      if (
        Number.isNaN(rechargeAmount) ||
        rechargeAmount < MINIMUM_RECHARGE_AMOUNT
      ) {
        setError(
          `Minimum recharge amount is ${formatRupees(
            MINIMUM_RECHARGE_AMOUNT
          )}.`
        );
        return;
      }

      const order = await garageApi.createRechargeOrder(
        garageToken,
        rechargeAmount
      );

      setPendingOrder(order.cashfreeOrder);
      setCashfreeMode(order.mode || "sandbox");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to create recharge order"
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyRecharge = async () => {
    if (!pendingOrder?.id) return;

    setLoading(true);
    setError("");

    try {
      await garageApi.verifyRechargeOrder(garageToken, pendingOrder.id);

      setPendingOrder(null);
      setShowRechargeModal(false);
      setAmount(MINIMUM_RECHARGE_AMOUNT);

      await loadWallet();
      await refreshGarage(garageToken);
    } catch (err) {
      setError(
        err.response?.data?.message || "Cashfree payment is not completed yet"
      );
    } finally {
      setLoading(false);
    }
  };

  const openCashfreeCheckout = async () => {
    if (!pendingOrder?.paymentSessionId) {
      setError("Payment session not created. Please try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loadCashfreeCheckout();

      const cashfree = window.Cashfree({
        mode: cashfreeMode,
      });

      const checkoutResult = await cashfree.checkout({
        paymentSessionId: pendingOrder.paymentSessionId,
        redirectTarget: "_modal",
      });

      if (checkoutResult?.error) {
        setError(checkoutResult.error.message || "Payment cancelled or failed");
      } else {
        await verifyRecharge();
      }
    } catch (err) {
      setError(err.message || "Unable to open Cashfree checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand/5">
      <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header Section */}
        <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm ring-1 ring-black/[0.03] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                Wallet
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                Manage your garage wallet and transaction history.
              </p>
            </div>

            <button
              type="button"
              onClick={loadWallet}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <FiRefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </section>

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-5">{error}</span>
          </div>
        )}

        {/* Balance Overview Card */}
        <section className="overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/5 via-white to-brand/10 shadow-sm ring-1 ring-black/[0.02]">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand-dark ring-1 ring-brand/20">
                    <FiCreditCard className="h-5 w-5" />
                  </div>

                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Available Balance
                  </p>
                </div>

                <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {formatRupees(balance)}
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  {formatRupees(minimumActivationAmount)} is required only for
                  first activation. After activation, keep enough wallet balance
                  to accept booking requests smoothly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRechargeModal(true)}
                className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-black shadow-sm transition hover:-translate-y-0.5 hover:brightness-95 sm:w-auto"
              >
                <FiPlus className="h-4 w-4" />
                Recharge Wallet
              </button>
            </div>
          </div>
        </section>

        {/* Transaction History */}
        <section className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm ring-1 ring-black/[0.02]">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h3 className="text-base font-semibold text-ink">
                Transaction History
              </h3>
              <p className="mt-1 text-xs text-muted">
                Recent wallet credits and deductions.
              </p>
            </div>

            <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-muted shadow-sm">
              {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}
            </span>
          </div>

          {transactions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {transactions.map((txn) => {
                const isCredit =
                  txn.type === "RECHARGE" || Number(txn.amount) > 0;

                return (
                  <div
                    key={txn.id}
                    className="flex flex-col gap-3 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                          isCredit
                            ? "border-green-100 bg-green-50 text-green-600"
                            : "border-red-100 bg-red-50 text-red-600"
                        }`}
                      >
                        {isCredit ? (
                          <FiArrowDown className="h-4 w-4" />
                        ) : (
                          <FiArrowUp className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {txn.description || txn.type || "Wallet transaction"}
                        </p>

                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <span>{formatWalletDate(txn.createdAt)}</span>
                          <span className="hidden text-slate-300 sm:inline">
                            •
                          </span>
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 font-medium uppercase tracking-wide ring-1 ring-slate-100">
                            {txn.status || "UNKNOWN"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div
                      className={`text-right text-base font-bold sm:text-sm ${
                        isCredit ? "text-green-600" : "text-ink"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatRupees(Math.abs(Number(txn.amount || 0)))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <FiCreditCard className="mb-3 h-8 w-8 text-muted" />
              <p className="text-sm font-semibold text-ink">
                No transactions yet
              </p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
                Your wallet history will appear here once you recharge or accept
                jobs.
              </p>
            </div>
          )}
        </section>

        {/* Recharge Modal */}
        {showRechargeModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-ink">
                    Recharge Wallet
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Create a Cashfree order. First activation requires at least{" "}
                    {formatRupees(minimumActivationAmount)}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeRechargeModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-slate-50 hover:text-ink"
                  aria-label="Close recharge modal"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              {!pendingOrder ? (
                <form onSubmit={createRecharge} className="space-y-5">
                  <div>
                    <label
                      htmlFor="amount"
                      className="mb-1.5 block text-xs font-semibold text-ink"
                    >
                      Amount (₹)
                    </label>

                    <input
                      id="amount"
                      type="number"
                      min={MINIMUM_RECHARGE_AMOUNT}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[100, 500, 1000].map((quickAmount) => (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => setAmount(quickAmount)}
                        className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                          Number(amount) === quickAmount
                            ? "border-brand bg-brand/15 text-ink"
                            : "border-slate-200 bg-white text-muted hover:bg-slate-50"
                        }`}
                      >
                        ₹{quickAmount}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={closeRechargeModal}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-black shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Creating..." : "Create Order"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                      <span className="text-muted">Order ID</span>
                      <span className="break-all font-medium text-ink sm:text-right">
                        {pendingOrder.id}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-muted">Amount</span>
                      <span className="font-medium text-ink">
                        {formatRupees(pendingOrder.amount || amount)}
                      </span>
                    </div>

                    {pendingOrder.paymentSessionId && (
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                        <span className="text-muted">Session</span>
                        <span className="break-all font-mono text-xs text-ink sm:max-w-[220px] sm:text-right">
                          {pendingOrder.paymentSessionId.substring(0, 32)}...
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={openCashfreeCheckout}
                      disabled={loading}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-black shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiCheckCircle className="h-4 w-4" />
                      {loading ? "Processing..." : "Open Payment Portal"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingOrder(null)}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-slate-50"
                    >
                      Create new order
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}