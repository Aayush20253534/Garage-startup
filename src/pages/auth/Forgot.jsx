import { Link } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { useState } from "react";
import { FiCheckCircle } from "react-icons/fi";

export default function Forgot() {
  const [sent, setSent] = useState(false);
  return (
    <div className="container-x py-16 min-h-[80vh] grid place-items-center">
      <div className="card-soft p-7 max-w-md w-full">
        <Logo className="h-9" showText={false} />
        {sent ? (
          <div className="text-center py-8">
            <div className="h-14 w-14 grid place-items-center bg-brand rounded-full mx-auto"><FiCheckCircle className="text-2xl" /></div>
            <h2 className="text-2xl font-bold mt-4">Check your phone</h2>
            <p className="text-muted text-sm mt-2">We sent reset instructions via SMS.</p>
            <Link to="/login" className="btn-dark mt-6 inline-flex">Back to login</Link>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="mt-4 grid gap-3">
            <h2 className="text-2xl font-bold">Forgot password</h2>
            <p className="text-sm text-muted">Enter your registered mobile number.</p>
            <input required maxLength={10} placeholder="Mobile number" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
            <button className="btn-primary">Send reset link</button>
            <Link to="/login" className="text-sm text-muted text-center hover:text-ink">Back to login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
