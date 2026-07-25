import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "@/api/admin";
import StaffBrand from "@/components/staff/StaffBrand";
import { FiAlertCircle, FiCheckCircle, FiKey, FiMail } from "react-icons/fi";

const getError = (error, fallback) => error.response?.data?.message || error.message || fallback;

export default function SubAdminForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("REQUEST");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestOtp = async (event) => {
    event.preventDefault(); setLoading(true); setError("");
    try { await adminApi.requestSubAdminPasswordReset(email.trim()); setStep("RESET"); setSuccess("If this active admin email exists, a reset OTP has been sent."); }
    catch (err) { setError(getError(err, "Unable to request password reset")); }
    finally { setLoading(false); }
  };
  const reset = async (event) => {
    event.preventDefault(); setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try { await adminApi.resetSubAdminPassword({ email: email.trim(), otp: otp.trim(), newPassword }); setSuccess("Password reset successfully. Existing sessions were revoked."); setTimeout(() => navigate("/admin/login", { replace: true }), 700); }
    catch (err) { setError(getError(err, "Unable to reset password")); }
    finally { setLoading(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <section className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-7">
      <StaffBrand portal="admin" />
      <div className="mt-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-white"><FiKey /></span><div><p className="text-xs font-bold uppercase tracking-wider text-muted">Admin recovery</p><h1 className="text-2xl font-extrabold text-ink">Reset password</h1></div></div>
      {error && <div className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><FiAlertCircle />{error}</div>}
      {success && <div className="mt-5 flex gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"><FiCheckCircle />{success}</div>}
      {step === "REQUEST" ? <form onSubmit={requestOtp} className="mt-6 space-y-4"><label className="block text-sm font-bold text-ink">Email<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line px-3 font-normal" placeholder="name@rovauto.com" /></label><button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink font-bold text-white"><FiMail />Send OTP</button></form> : <form onSubmit={reset} className="mt-6 space-y-4"><input required inputMode="numeric" pattern="\d{6}" maxLength="6" value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,""))} placeholder="6-digit OTP" className="h-11 w-full rounded-lg border border-line px-3"/><input required type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="New strong password" className="h-11 w-full rounded-lg border border-line px-3"/><input required type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="Confirm password" className="h-11 w-full rounded-lg border border-line px-3"/><button disabled={loading} className="h-11 w-full rounded-lg bg-ink font-bold text-white">Reset password</button></form>}
      <Link to="/admin/login" className="mt-5 block text-center text-sm font-bold text-muted">Back to admin login</Link>
    </section>
  </main>;
}
