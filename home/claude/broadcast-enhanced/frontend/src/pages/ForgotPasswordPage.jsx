/**
 * ForgotPasswordPage — sends reset link to email
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/api";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email address.");
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
      toast.success("Reset link sent if email is registered.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-slide-up">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-8 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to login
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check your inbox</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
            </p>
            <Link to="/login" className="btn-primary inline-flex mt-6">Return to login</Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Forgot password?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Enter your email and we'll send a reset link.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input" placeholder="you@example.com" required autoFocus/>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full h-10">
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
