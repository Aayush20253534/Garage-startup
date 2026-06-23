import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import Logo from "@/components/common/Logo";
import { FiUser, FiTool } from "react-icons/fi";

export default function Register() {
  const [role, setRole] = useState("customer");
  const nav = useNavigate();
  return (
    <div className="container-x py-16 grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
      <div className="hidden lg:block">
        <Logo />
        <h1 className="text-5xl font-bold mt-8 leading-tight">Create your <span className="text-brand-dark">Rovauto</span> account.</h1>
        <p className="text-muted mt-4 max-w-md">Track your car's health, book trusted services and unlock loyalty rewards.</p>
      </div>
      <div className="card-soft p-7 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-bold">Get started</h2>
        <div className="mt-5 grid grid-cols-2 gap-2 p-1 bg-bg-soft rounded-full">
          {[["customer", "Customer", FiUser], ["garage", "Garage Partner", FiTool]].map(([k, l, Ic]) => (
            <button key={k} onClick={() => setRole(k)} className={`flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition ${role === k ? "bg-ink text-white" : "text-ink/70"}`}>
              <Ic /> {l}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); nav("/otp", { state: { role } }); }} className="mt-6 grid gap-3">
          <input required placeholder="Full name" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
          <input required type="email" placeholder="Email" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
          <input required maxLength={10} placeholder="Mobile number" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" />
          <button className="btn-primary mt-2">Create Account</button>
          <div className="text-center text-sm text-muted">Already a member? <Link to="/login" className="text-ink font-medium">Login</Link></div>
        </form>
      </div>
    </div>
  );
}
