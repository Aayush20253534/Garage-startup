import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { setWallet } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
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

  const transactions = Array.isArray(wallet?.transactions)
    ? wallet.transactions
    : [];

  const balance = Number(wallet?.balance || 0);

  const minimumBalance =
    wallet?.activation?.minimumBalance || MINIMUM_RECHARGE_AMOUNT;

  const loadWallet = async () => {
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
  };

  useEffect(() => {
    loadWallet();
  }, [garageToken]);

  const createRecharge = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const rechargeAmount = Number(amount);

      if (Number.isNaN(rechargeAmount) || rechargeAmount < MINIMUM_RECHARGE_AMOUNT) {
        setError(`Minimum recharge amount is ₹${MINIMUM_RECHARGE_AMOUNT}.`);
        return;
      }

      const order = await garageApi.createRechargeOrder(
        garageToken,
        rechargeAmount
      );

      setPendingOrder(order.cashfreeOrder);
      setCashfreeMode(order.mode || "sandbox");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create recharge order");
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
    <div className="mx-auto max-w-6xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Wallet</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your garage wallet and transaction history.
          </p>
        </div>

        <button
          type="button"
          onClick={loadWallet}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FiAlertCircle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-soft to-white p-5 shadow-sm sm:p-6">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">
              Available Balance
            </p>

            <h2 className="mt-2 text-4xl font-bold text-ink sm:text-5xl">
              ₹{balance.toLocaleString()}
            </h2>

            <p className="mt-3 text-sm text-muted">
              Minimum ₹{minimumBalance} wallet balance required for activation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowRechargeModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-black transition hover:bg-brand-dark"
          >
            <FiPlus />
            Recharge Wallet
          </button>
        </div>
      </section>

      <section className="card-soft rounded-2xl p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">
              Transaction History
            </h3>
            <p className="text-sm text-muted">
              Recent wallet credits and deductions.
            </p>
          </div>

          <span className="rounded-full bg-bg-soft px-3 py-1 text-xs font-bold text-muted">
            {transactions.length} transactions
          </span>
        </div>

        <div className="grid gap-3">
          {transactions.length > 0 ? (
            transactions.map((txn) => {
              const isCredit =
                txn.type === "RECHARGE" || Number(txn.amount) > 0;

              return (
                <div
                  key={txn.id}
                  className="flex flex-col gap-3 rounded-xl bg-bg-soft p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        isCredit
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700",
                      ].join(" ")}
                    >
                      {isCredit ? <FiArrowDown /> : <FiArrowUp />}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">
                        {txn.description || txn.type}
                      </p>

                      <p className="text-sm text-muted">
                        {txn.createdAt
                          ? new Date(txn.createdAt).toLocaleDateString()
                          : "-"}{" "}
                        · {txn.status || "UNKNOWN"}
                      </p>
                    </div>
                  </div>

                  <p
                    className={[
                      "text-lg font-bold",
                      isCredit ? "text-green-700" : "text-red-700",
                    ].join(" ")}
                  >
                    {isCredit ? "+" : "-"}₹
                    {Math.abs(Number(txn.amount || 0)).toLocaleString()}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-bg-soft p-5 text-sm text-muted">
              No wallet transactions yet. Money has, for once, stayed out of
              trouble.
            </div>
          )}
        </div>
      </section>

      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-ink">
                  Recharge Wallet
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Create a Cashfree recharge order. Minimum amount is ₹100.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowRechargeModal(false);
                  setPendingOrder(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink transition hover:border-ink hover:bg-bg-soft"
              >
                <FiX />
              </button>
            </div>

            {!pendingOrder ? (
              <form onSubmit={createRecharge} className="grid gap-4">
                <input
                  type="number"
                  min={MINIMUM_RECHARGE_AMOUNT}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-11 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRechargeModal(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Creating..." : "Create Order"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-xl bg-bg-soft p-4 text-sm">
                  <p>
                    <span className="text-muted">Order ID:</span>{" "}
                    {pendingOrder.id}
                  </p>

                  <p>
                    <span className="text-muted">Amount:</span> ₹
                    {Number(pendingOrder.amount || amount).toLocaleString()}
                  </p>

                  {pendingOrder.paymentSessionId && (
                    <p className="break-all">
                      <span className="text-muted">Payment Session:</span>{" "}
                      {pendingOrder.paymentSessionId.substring(0, 30)}...
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={openCashfreeCheckout}
                  disabled={loading}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiCheckCircle />
                  {loading ? "Processing..." : "Open Payment Portal"}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingOrder(null)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
                >
                  Create another order
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}