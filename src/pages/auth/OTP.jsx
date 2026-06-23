import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/hooks/useApp";
import Logo from "@/components/common/Logo";

export default function OTP() {
  const { state } = useLocation();
  const role = state?.role || "customer";
  const from = state?.from?.pathname || null;
  const [otp, setOtp] = useState(Array(6).fill(""));
  const refs = useRef([]);
  const nav = useNavigate();
  const { login, vehicles } = useApp();
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  const set = (i, v) => {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const submit = (e) => {
    e.preventDefault();
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
  };

  return (
    <div className="container-x py-16 min-h-[80vh] grid place-items-center">
      <div className="card-soft p-7 max-w-md w-full text-center">
        <Logo className="h-10 mx-auto" showText={false} />
        <h2 className="text-2xl font-bold mt-4">Verify your number</h2>
        <p className="text-sm text-muted mt-1">We've sent a 6-digit code to <span className="text-ink font-medium">+91 90000 00000</span></p>
        <form onSubmit={submit} className="mt-6">
          <div className="flex justify-center gap-2">
            {otp.map((v, i) => (
              <input key={i} ref={(el) => (refs.current[i] = el)} value={v} onChange={(e) => set(i, e.target.value)}
                maxLength={1} inputMode="numeric"
                className="h-14 w-12 text-center text-xl font-bold rounded-2xl border border-line focus:border-ink outline-none" />
            ))}
          </div>
          <button className="btn-primary mt-6 w-full">Verify & Continue</button>
          <div className="text-sm text-muted mt-4">{timer > 0 ? `Resend in ${timer}s` : <button type="button" onClick={() => setTimer(30)} className="text-ink font-medium">Resend OTP</button>}</div>
        </form>
      </div>
    </div>
  );
}
