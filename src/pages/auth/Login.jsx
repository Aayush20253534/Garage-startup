import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import Logo from "@/components/common/Logo";
import { FiArrowRight, FiTool, FiUser } from "react-icons/fi";

export default function Login() {
  const { state } = useLocation();
  const from = state?.from?.pathname || null;
  const [role, setRole] = useState("customer");
  const [phone, setPhone] = useState("");
  const nav = useNavigate();
  const { login, vehicles } = useApp();
  return (
    <div className="container-x py-16 grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
      <div className="hidden lg:block">
        <Logo />
        <h1 className="text-5xl font-bold mt-8 leading-tight">Welcome back.<br /><span className="text-muted">Your garage on demand.</span></h1>
      </div>
      <div className="card-soft p-7 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-bold">Login to Rovauto</h2>
        <p className="text-sm text-muted mt-1">Continue with OTP</p>
        <div className="mt-5 grid grid-cols-2 gap-2 p-1 bg-bg-soft rounded-full">
          {[["customer", "Customer", FiUser], ["garage", "Garage Partner", FiTool]].map(([k, l, Ic]) => (
            <button key={k} onClick={() => setRole(k)} className={`flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition ${role === k ? "bg-ink text-white" : "text-ink/70"}`}>
              <Ic /> {l}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); nav("/otp", { state: { phone, role, from } }); }} className="mt-6 grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Mobile Number</span>
            <div className="flex">
              <span className="px-4 py-3 rounded-l-xl bg-bg-soft border border-line border-r-0 text-sm">+91</span>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} placeholder="90000 00000" className="flex-1 px-4 py-3 rounded-r-xl border border-line focus:border-ink outline-none" />
            </div>
          </label>
          <button className="btn-primary mt-2">Send OTP <FiArrowRight /></button>
          <Link to="/forgot" className="text-sm text-muted hover:text-ink text-center mt-1">Forgot something?</Link>
          <div className="text-center text-sm text-muted">New to Rovauto? <Link to="/register" className="text-ink font-medium">Create account</Link></div>
          <button type="button" onClick={() => { 
            login("Ayush", role); 
            if (role === "garage") {
              nav("/garage");
            } else {
              if (from && from !== "/booking/vehicle") {
                nav(from);
              } else if (vehicles.length === 0) {
                nav("/booking/vehicle");
              } else {
                nav("/dashboard");
              }
            }
          }} className="btn-ghost text-xs">Demo login (skip OTP)</button>
        </form>
      </div>
    </div>
  );
}
