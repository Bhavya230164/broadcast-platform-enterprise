/**
 * RegisterPage — Enhanced
 * Supports: name, email, password, role selection
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import toast from "react-hot-toast";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, isAuthenticated, user, clearError } = useAuthStore();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });

  useEffect(() => {
    if (isAuthenticated && user)
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [isAuthenticated, user, navigate]);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); clearError(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error("Fill in all fields.");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters.");
    const res = await register(form.name, form.email, form.password, form.role);
    if (res.success) {
      toast.success("Account created!");
      navigate(res.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 011.414-1.414zM10 9a1 1 0 110 2 1 1 0 010-2z"/>
            </svg>
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">Broadcast</span>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Create account</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Join the platform to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
              className="input" placeholder="Jane Smith" autoComplete="name" required/>
          </div>
          <div>
            <label className="label">Email address</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              className="input" placeholder="you@example.com" autoComplete="email" required/>
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
              className="input" placeholder="Min. 6 characters" autoComplete="new-password" required/>
          </div>

          {/* Account type info */}
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              You will be registered as a <span className="font-medium text-slate-600 dark:text-slate-300">Member</span>. Members receive messages from the Admin.
            </p>
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full h-10 mt-1">
            {isLoading ? <Spinner/> : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
