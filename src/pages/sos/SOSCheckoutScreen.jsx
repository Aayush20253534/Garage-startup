import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/hooks/useApp";

export default function SOSCheckoutScreen() {
  const [searchParams] = useSearchParams();
  const problem = searchParams.get("problem");
  const nav = useNavigate();
  const { user } = useApp();

  const handlePay = () => {
    if (!user) {
      nav("/login?redirect=/sos/checkout?problem=" + problem);
      return;
    }
    // Simulate payment
    setTimeout(() => nav("/sos/success"), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container-x py-10">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Pay to Find Mechanic</h1>
        </div>
        <div className="max-w-md mx-auto bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="mb-6">
            <div className="flex justify-between py-3 border-b border-gray-700">
              <span className="text-gray-300">Emergency Dispatch Fee</span>
              <span className="font-bold text-brand">₹49</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-300">Mechanic Visit (Est.)</span>
              <span className="font-semibold">₹200 - ₹300</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Mechanic will confirm final cost after inspection</p>
          </div>
          <button
            onClick={handlePay}
            className="w-full p-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-lg transition-all"
          >
            Pay ₹49 & Find Mechanic
          </button>
        </div>
      </div>
    </div>
  );
}
