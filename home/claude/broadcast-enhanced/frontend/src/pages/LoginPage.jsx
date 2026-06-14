/**
 * LoginPage — Enhanced
 * Supports: password login, OTP login tab, 2FA verification step
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { authService } from "../services/api";
import toast from "react-hot-toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithOTP, isLoading, isAuthenticated, user, clearError } = useAuthStore();

  // 'password' | 'otp' | '2fa'
  const [tab, setTab] = useState("password");
  const [form, setForm] = useState({ email: "", password: "", otp: "", totpToken: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [tempToken, setTempToken] = useState(null); // for 2FA flow

  useEffect(() => {
    if (isAuthenticated && user)
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [isAuthenticated, user, navigate]);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); clearError(); };

  // ── Password login ─────────────────────────────────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error("Fill in all fields.");
    const res = await login(form.email, form.password);
    if (res.success && res.require2FA) {
      setTempToken(res.tempToken);
      setTab("2fa");
      toast("Enter your 2FA code to continue.", { icon: "🔐" });
    } else if (res.success) {
      toast.success("Welcome back!");
      navigate(res.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } else {
      toast.error(res.message);
    }
  };

  // ── OTP flow ───────────────────────────────────────────────────────────────
  const handleRequestOTP = async () => {
  if (!form.email) return toast.error("Enter your email first.");

  setOtpLoading(true);

  try {
    const response = await authService.requestOTP(form.email);

    console.log("OTP SUCCESS:", response.data);

    setOtpSent(true);
    toast.success("OTP sent to your email!");
  } catch (err) {
    console.log("OTP ERROR:", err);
    console.log("STATUS:", err?.response?.status);
    console.log("DATA:", err?.response?.data);

    toast.error(err?.response?.data?.message || "Failed to send OTP.");
  } finally {
    setOtpLoading(false);
  }
};

  const handleOTPLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.otp) return toast.error("Enter both email and OTP.");
    
    const res = await loginWithOTP(form.email, form.otp);
    
    if (res.success) {
      toast.success("Welcome back!");
      navigate(res.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } else {
      toast.error(res.message);
    }
  };

  // ── 2FA verification ───────────────────────────────────────────────────────
  const handle2FAVerify = async (e) => {
    e.preventDefault();
    if (!form.totpToken) return toast.error("Enter your 6-digit authenticator code.");
    try {
      const { data } = await authService.verify2FA(form.totpToken, tempToken);
      useAuthStore.getState()._persist(data.token, data.user);
      toast.success("2FA verified!");
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid 2FA code.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-700 dark:bg-brand-900 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 011.414-1.414zM10 9a1 1 0 110 2 1 1 0 010-2z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-xl">Broadcast</span>
          </div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            One voice.<br />Many ears.<br />Zero crosstalk.
          </h1>
          <p className="text-brand-200 text-lg leading-relaxed">
            Secure, real-time broadcast communications for teams and organizations.
          </p>
        </div>
        <div className="space-y-3">
          {["End-to-end role isolation", "Real-time Socket.IO delivery", "Priority & selective messaging", "Meeting scheduling & reminders"].map((f) => (
            <div key={f} className="flex items-center gap-3 text-brand-200 text-sm">
              <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Sign in</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Choose how you'd like to sign in.</p>
          </div>

          {/* Tab switcher — only show when not in 2FA step */}
          {tab !== "2fa" && (
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
              {[["password", "Password"], ["otp", "Email OTP"]].map(([key, label]) => (
                <button key={key} onClick={() => { setTab(key); setOtpSent(false); clearError(); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === key ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── Password form ── */}
          {tab === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                  className="input" placeholder="you@example.com" autoComplete="email" required />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Password</label>
                  <Link to="/forgot-password" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Forgot password?</Link>
                </div>
                <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
                  className="input" placeholder="••••••••" autoComplete="current-password" required />
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full h-10 mt-1">
                {isLoading ? <Spinner /> : "Sign in"}
              </button>
            </form>
          )}

          {/* ── OTP form ── */}
          {tab === "otp" && (
            <form onSubmit={handleOTPLogin} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <div className="flex gap-2">
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                    className="input flex-1" placeholder="you@example.com" required />
                  <button type="button" onClick={handleRequestOTP} disabled={otpLoading || otpSent}
                    className="btn-secondary whitespace-nowrap flex-shrink-0">
                    {otpLoading ? <Spinner /> : otpSent ? "Sent ✓" : "Send OTP"}
                  </button>
                </div>
              </div>
              {otpSent && (
                <div>
                  <label className="label">6-digit OTP</label>
                  <input type="text" value={form.otp} onChange={(e) => set("otp", e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input tracking-[0.3em] text-center font-mono text-lg" placeholder="000000" maxLength={6} autoFocus />
                </div>
              )}
              <button type="submit" disabled={isLoading || !otpSent} className="btn-primary w-full h-10">
                {isLoading ? <Spinner /> : "Verify OTP & Sign in"}
              </button>
              {otpSent && (
                <button type="button" onClick={() => setOtpSent(false)} className="btn-ghost w-full text-sm">
                  Resend OTP
                </button>
              )}
            </form>
          )}

          {/* ── 2FA form ── */}
          {tab === "2fa" && (
            <form onSubmit={handle2FAVerify} className="space-y-4">
              <div className="text-center p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800 mb-2">
                <div className="text-3xl mb-2">🔐</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Two-Factor Verification</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <div>
                <label className="label">Authenticator Code</label>
                <input type="text" value={form.totpToken}
                  onChange={(e) => set("totpToken", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="input tracking-[0.3em] text-center font-mono text-2xl h-14"
                  placeholder="000000" maxLength={6} autoFocus />
              </div>
              <button type="submit" className="btn-primary w-full h-10">Verify</button>
              <button type="button" onClick={() => { setTab("password"); setTempToken(null); }}
                className="btn-ghost w-full text-sm">← Back to login</button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);
