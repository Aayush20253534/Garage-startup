import { useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import { FiCheckCircle, FiLock, FiTruck } from "react-icons/fi";

export default function Checkout() {
  const { cart, vehicle, clearCart } = useApp();
  const nav = useNavigate();
  const subTotal = cart.reduce((a, b) => a + b.price, 0) || 3500;
  const fee = 49;
  const payNow = fee;
  const payAtGarage = subTotal;

  const pay = () => { clearCart(); nav("/tracking"); };

  return (
    <div className="container-x py-12 grid lg:grid-cols-[1fr_400px] gap-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold">Checkout</h1>
        <p className="text-muted mt-1">Pay a small fee to confirm your booking. Rest pays at garage.</p>

        <div className="mt-8 card-soft p-6">
          <h3 className="font-semibold text-lg mb-4">Payment Method</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[["UPI", "PhonePe, GPay, Paytm"], ["Razorpay", "Cards, Wallets"], ["Credit / Debit Card", "Visa, Master, Amex"], ["Net Banking", "All major banks"]].map(([n, d], i) => (
              <label key={n} className={`rounded-2xl border p-4 flex items-start gap-3 cursor-pointer ${i === 0 ? "border-ink bg-bg-soft" : "border-line"}`}>
                <input type="radio" name="pay" defaultChecked={i === 0} className="mt-1 accent-ink" />
                <div><div className="font-semibold">{n}</div><div className="text-xs text-muted">{d}</div></div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 card-soft p-6">
          <h3 className="font-semibold text-lg mb-4">Benefits with this booking</h3>
          <ul className="grid sm:grid-cols-2 gap-3 text-sm">
            {["Booking Confirmation", "Priority Slot", "30-Day Warranty", "24x7 Customer Support"].map((b) => (
              <li key={b} className="flex items-center gap-2"><FiCheckCircle className="text-brand-dark" /> {b}</li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="card-soft p-6 lg:sticky lg:top-24 h-fit">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand"><FiTruck /></span>
          <div className="text-sm"><div className="font-semibold">{vehicle?.brand || "Hyundai"} {vehicle?.model || "i20"}</div><div className="text-xs text-muted">{vehicle?.fuel || "Petrol"}</div></div>
        </div>
        <hr className="my-4 border-line" />
        <div className="font-semibold mb-2">Order Summary</div>
        <div className="grid gap-2 text-sm">
          {(cart.length ? cart : [{ id: "demo", name: "Standard Service Package", price: 3500 }]).map((c) => (
            <div key={c.id} className="flex justify-between"><span>{c.name}</span><span className="font-semibold">₹{c.price}</span></div>
          ))}
          <div className="flex justify-between text-muted"><span>Platform fee</span><span>₹{fee}</span></div>
        </div>
        <hr className="my-4 border-line" />
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">Pay at garage</span><span className="font-semibold">₹{payAtGarage}</span></div>
          <div className="flex justify-between text-base"><span className="font-semibold">Pay now</span><span className="font-bold text-xl">₹{payNow}</span></div>
        </div>
        <button onClick={pay} className="btn-primary w-full mt-5"><FiLock /> Pay ₹{payNow} & Book Slot</button>
        <div className="text-xs text-muted text-center mt-3">Secured by Razorpay · 100% refund on cancellation</div>
      </aside>
    </div>
  );
}
