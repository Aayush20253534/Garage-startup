import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { FiPlus, FiArrowDown, FiArrowUp, FiCheckCircle } from "react-icons/fi";
import { setWallet } from "@/store/garageSlice";
import { garageApi } from "@/api/garage";
import { useApp } from "@/hooks/useApp";

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

const MINIMUM_RECHARGE_AMOUNT = 100;

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
        }),
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load wallet");
    }
  };

  useEffect(() => {
    loadWallet();
  }, [garageToken]);

  const createRecharge = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const order = await garageApi.createRechargeOrder(
        garageToken,
        Number(amount),
      );
      setPendingOrder(order.cashfreeOrder);
      setCashfreeMode(order.mode || "sandbox");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to create recharge order",
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
        // Payment completed, verify the order
        await verifyRecharge();
      }
    } catch (err) {
      setError(err.message || "Unable to open Cashfree checkout");
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
        err.response?.data?.message || "Cashfree payment is not completed yet",
      );
    } finally {
      setLoading(false);
    }
  };

  const transactions = wallet.transactions || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Wallet</h1>
        <p className="text-muted">Manage your wallet and transactions</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}

      <div className="card-soft p-8 text-center bg-gradient-to-br from-brand-soft to-white">
        <p className="text-muted mb-2">Available Balance</p>
        <h2 className="text-5xl font-bold mb-3">
          ₹{Number(wallet.balance || 0).toLocaleString()}
        </h2>
        <p className="text-sm text-muted mb-6">
          Minimum ₹{wallet.activation?.minimumBalance || MINIMUM_RECHARGE_AMOUNT} wallet balance
          required for activation
        </p>
        <button
          onClick={() => setShowRechargeModal(true)}
          className="btn-primary"
        >
          <FiPlus className="w-4 h-4" />
          Recharge Wallet
        </button>
      </div>

      <div className="card-soft p-6">
        <h3 className="text-xl font-bold mb-4">Transaction History</h3>
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((txn) => {
              const isCredit =
                txn.type === "RECHARGE" || Number(txn.amount) > 0;
              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 bg-bg-soft rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${isCredit ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {isCredit ? <FiArrowDown /> : <FiArrowUp />}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {txn.description || txn.type}
                      </p>
                      <p className="text-muted text-sm">
                        {new Date(txn.createdAt).toLocaleDateString()} •{" "}
                        {txn.status}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-bold ${isCredit ? "text-green-700" : "text-red-700"}`}
                  >
                    {isCredit ? "+" : "-"}₹{" "}
                    {Math.abs(Number(txn.amount || 0)).toLocaleString()}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-muted">No wallet transactions yet.</p>
          )}
        </div>
      </div>

      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-xl font-bold mb-2">Recharge Wallet</h3>
            <p className="text-muted mb-5">
              Create a Cashfree recharge order. Minimum amount is Rs. 100.
            </p>

            {!pendingOrder ? (
              <form onSubmit={createRecharge} className="space-y-4">
                <input
                  type="number"
                  min={MINIMUM_RECHARGE_AMOUNT}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-line px-4 py-3 focus:border-ink focus:outline-none"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRechargeModal(false)}
                    className="btn-ghost flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1"
                  >
                    {loading ? "Creating..." : "Create Order"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-bg-soft p-4 text-sm">
                  <p>
                    <span className="text-muted">Order ID:</span>{" "}
                    {pendingOrder.id}
                  </p>
                  <p>
                    <span className="text-muted">Amount:</span> ₹{" "}
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
                  onClick={openCashfreeCheckout}
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  <FiCheckCircle />
                  {loading ? "Processing..." : "Open Payment Portal"}
                </button>
                <button
                  onClick={() => setPendingOrder(null)}
                  className="btn-ghost w-full"
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

