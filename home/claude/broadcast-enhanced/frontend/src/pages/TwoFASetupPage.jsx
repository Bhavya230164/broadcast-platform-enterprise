/**
 * TwoFASetupPage — FIXED VERSION
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/api";
import useAuthStore from "../store/useAuthStore";
import Navbar from "../components/layout/Navbar";
import toast from "react-hot-toast";

export default function TwoFASetupPage() {
  const navigate = useNavigate();

  // FIX: safer store usage
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState("idle");
  const [qrCode, setQrCode] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Load 2FA status
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await authService.getMe();
        setIs2FAEnabled(data?.user?.twoFA?.enabled || false);
      } catch (err) {
        console.log("getMe failed", err);
      }
    };
    load();
  }, []);

  // STEP 2: setup QR
  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data } = await authService.setup2FA();

      setQrCode(data?.qrCode || "");
      setManualKey(data?.manualKey || "");

      setStep("confirm");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: enable
  const handleEnable = async (e) => {
    e.preventDefault();

    if (token.length !== 6) {
      return toast.error("Enter 6-digit code");
    }

    setLoading(true);
    try {
      await authService.enable2FA(token);

      setIs2FAEnabled(true);
      setStep("idle");
      setToken("");

      toast.success("2FA enabled successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // disable
  const handleDisable = async () => {
    if (!window.confirm("Disable 2FA?")) return;

    setLoading(true);
    try {
      await authService.disable2FA();
      setIs2FAEnabled(false);
      toast.success("2FA disabled");
    } catch (err) {
      toast.error("Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 py-6">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="text-sm mb-4 text-gray-500">
          ← Back
        </button>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">

          <h1 className="text-lg font-bold mb-2">
            Two-Factor Authentication
          </h1>

          <p className="text-sm text-gray-500 mb-4">
            Secure your account with OTP authentication
          </p>

          {/* STATUS */}
          <div className="mb-4 text-sm">
            Status:{" "}
            <span className={is2FAEnabled ? "text-green-500" : "text-red-500"}>
              {is2FAEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {/* STEP IDLE */}
          {step === "idle" && (
            <div>
              {!is2FAEnabled ? (
                <button
                  onClick={handleSetup}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded w-full"
                >
                  {loading ? "Loading..." : "Enable 2FA"}
                </button>
              ) : (
                <button
                  onClick={handleDisable}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded w-full"
                >
                  Disable 2FA
                </button>
              )}
            </div>
          )}

          {/* STEP CONFIRM */}
          {step === "confirm" && (
            <form onSubmit={handleEnable} className="space-y-4">

              {/* QR */}
              {qrCode && (
                <img
                  src={qrCode}
                  alt="QR Code"
                  className="mx-auto w-40 h-40"
                />
              )}

              {/* KEY */}
              <div className="text-xs break-all bg-gray-100 p-2 rounded">
                {manualKey}
              </div>

              {/* OTP INPUT */}
              <input
                value={token}
                onChange={(e) =>
                  setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit OTP"
                className="w-full border p-2 rounded text-center tracking-widest"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("idle")}
                  className="flex-1 bg-gray-400 text-white py-2 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 rounded"
                >
                  {loading ? "Verifying..." : "Enable"}
                </button>
              </div>

            </form>
          )}

        </div>
      </main>
    </div>
  );
}