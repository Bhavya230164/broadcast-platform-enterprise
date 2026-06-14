/**
 * TwoFASetupPage — scan QR, confirm TOTP, enable/disable 2FA
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/api";
import useAuthStore from "../store/useAuthStore";
import Navbar from "../components/layout/Navbar";
import toast from "react-hot-toast";

export default function TwoFASetupPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState("idle"); // idle | setup | confirm
  const [qrCode, setQrCode] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Fetch current 2FA status on mount
  useEffect(() => {
    authService.getMe().then(({ data }) => {
      setIs2FAEnabled(data.user?.twoFA?.enabled || false);
    }).catch(() => {});
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data } = await authService.setup2FA();
      setQrCode(data.qrCode);
      setManualKey(data.manualKey);
      setStep("confirm");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start 2FA setup.");
    } finally { setLoading(false); }
  };

  const handleEnable = async (e) => {
    e.preventDefault();
    if (token.length !== 6) return toast.error("Enter the 6-digit code.");
    setLoading(true);
    try {
      await authService.enable2FA(token);
      setIs2FAEnabled(true);
      setStep("idle");
      setToken("");
      toast.success("Two-factor authentication enabled!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid code. Try again.");
    } finally { setLoading(false); }
  };

  const handleDisable = async () => {
    if (!window.confirm("Disable two-factor authentication? This reduces your account security.")) return;
    setLoading(true);
    try {
      await authService.disable2FA();
      setIs2FAEnabled(false);
      toast.success("2FA disabled.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disable 2FA.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-10 animate-slide-up">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-8 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        <div className="card-p space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Two-Factor Authentication</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add an extra layer of security to your account.</p>
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
            is2FAEnabled
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${is2FAEnabled ? "bg-emerald-500" : "bg-slate-400"}`}/>
            {is2FAEnabled ? "2FA is currently enabled" : "2FA is currently disabled"}
          </div>

          {/* Step: idle */}
          {step === "idle" && (
            <div className="space-y-3">
              {is2FAEnabled ? (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Your account is protected by two-factor authentication. Each login requires a time-based code from your authenticator app.
                  </p>
                  <button onClick={handleDisable} disabled={loading} className="btn-danger w-full h-10">
                    {loading ? "Disabling…" : "Disable 2FA"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Use an authenticator app like <strong>Google Authenticator</strong> or <strong>Authy</strong> to generate time-based codes for login.
                  </p>
                  <button onClick={handleSetup} disabled={loading} className="btn-primary w-full h-10">
                    {loading ? "Setting up…" : "Enable 2FA"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step: confirm — show QR + input */}
          {step === "confirm" && (
            <form onSubmit={handleEnable} className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  1. Scan this QR code with your authenticator app:
                </p>
                {qrCode && (
                  <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-200 dark:border-slate-700">
                    <img src={qrCode} alt="2FA QR Code" className="w-44 h-44"/>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Or enter this key manually:
                </p>
                <code className="block text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 break-all font-mono">
                  {manualKey}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  2. Enter the 6-digit code from your app:
                </p>
                <input type="text" value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="input text-center tracking-[0.4em] font-mono text-xl h-14"
                  placeholder="000000" maxLength={6} autoFocus/>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep("idle"); setToken(""); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading || token.length !== 6} className="btn-primary flex-1">
                  {loading ? "Verifying…" : "Confirm & Enable"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
