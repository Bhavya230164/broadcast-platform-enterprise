/**
 * ResetPasswordPage — reads ?token= from URL, lets user set new password
 */
import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/api";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error("Invalid or missing reset token.");
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword: password });
      setDone(true);
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed. Link may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-4">Invalid reset link.</p>
          <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-slide-up">
        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Password updated!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Set new password</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Choose a strong password for your account.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input" placeholder="Min. 6 characters" autoFocus required/>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="input" placeholder="Repeat your password" required/>
              </div>
              {password && confirm && password !== confirm && (
                <p className="text-xs text-red-500">Passwords do not match.</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full h-10">
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
