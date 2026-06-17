/**
 * ProfilePage — Full profile management
 * Features: view/edit name, upload/change/remove avatar, change password,
 *           dark mode toggle, email notification preference
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { profileService, authService } from "../services/api";
import Navbar, { UserAvatar } from "../components/layout/Navbar";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser, setDarkMode } = useAuthStore();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(
    user?.avatar?.url ? `${API_BASE}${user.avatar.url}` : null
  );

  // Password change state
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  // Re-sync if user changes externally
  useEffect(() => {
    setName(user?.name || "");
    setPreviewUrl(user?.avatar?.url ? `${API_BASE}${user.avatar.url}` : null);
  }, [user]);

  // ── Profile info update ──────────────────────────────────────────────────────
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name cannot be empty.");
    setProfileLoading(true);
    try {
      const { data } = await profileService.update({ name: name.trim() });
      updateUser(data.user);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed.");
    } finally { setProfileLoading(false); }
  };

  // ── Avatar upload ────────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB.");

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("avatar", file);
    setAvatarLoading(true);
    try {
      const { data } = await profileService.uploadAvatar(formData);
      updateUser(data.user);
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed.");
      setPreviewUrl(user?.avatar?.url ? `${API_BASE}${user.avatar.url}` : null);
    } finally { setAvatarLoading(false); }
  };

  // ── Avatar remove ────────────────────────────────────────────────────────────
  const handleRemoveAvatar = async () => {
    if (!user?.avatar?.url) return;
    if (!window.confirm("Remove your profile photo?")) return;
    setAvatarLoading(true);
    try {
      const { data } = await profileService.removeAvatar();
      updateUser({ ...user, avatar: { url: null, publicId: null } });
      setPreviewUrl(null);
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove photo.");
    } finally { setAvatarLoading(false); }
  };

  // ── Dark mode toggle ─────────────────────────────────────────────────────────
  const handleDarkModeToggle = async () => {
    try {
      const newVal = !user?.preferences?.darkMode;
      await profileService.toggleDarkMode();
      setDarkMode(newVal);
      updateUser({ ...user, preferences: { ...user?.preferences, darkMode: newVal } });
      toast.success(newVal ? "Dark mode on" : "Light mode on");
    } catch { toast.error("Could not update preference."); }
  };

  // ── Broadcast app notifications toggle ──────────────────────────────────────
  const handleAppNotifToggle = async () => {
    if (!("Notification" in window)) {
      return toast.error("This browser does not support desktop notifications.");
    }

    try {
      const nextValue = !user?.preferences?.appNotifications;
      
      if (nextValue) {
        if (Notification.permission === "denied") {
          toast.error("Notifications are blocked by your browser. Please enable them in browser settings.");
          return;
        }
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            toast.error("Permission not granted. Notifications remain disabled.");
            return;
          }
        }
      }

      const updatedPrefs = { ...user?.preferences, appNotifications: nextValue };
      await profileService.update({ preferences: updatedPrefs });
      updateUser({ ...user, preferences: updatedPrefs });
      toast.success(nextValue ? "Broadcast App Notifications enabled" : "Broadcast App Notifications disabled");
    } catch {
      toast.error("Could not update notification preference.");
    }
  };

  // ── Email notifications toggle ───────────────────────────────────────────────
  const handleEmailNotifToggle = async () => {
    try {
      const newVal = !user?.preferences?.emailNotifications;
      const updatedPrefs = { ...user?.preferences, emailNotifications: newVal };
      await profileService.update({ preferences: updatedPrefs });
      updateUser({ ...user, preferences: updatedPrefs });
      toast.success(newVal ? "Email notifications on" : "Email notifications off");
    } catch { toast.error("Could not update preference."); }
  };

  // ── Password change ──────────────────────────────────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword.length < 6) return toast.error("New password must be at least 6 characters.");
    if (pwForm.newPassword !== pwForm.confirm) return toast.error("Passwords do not match.");
    setPwLoading(true);
    try {
      await authService.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password changed successfully.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password.");
    } finally { setPwLoading(false); }
  };

  const isDark = user?.preferences?.darkMode;
  const appNotif = user?.preferences?.appNotifications !== false;
  const emailNotif = user?.preferences?.emailNotifications !== false;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-8 pb-28 space-y-6 animate-slide-up">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        </div>

        {/* ── Avatar card ──────────────────────────────────────────────────── */}
        <div className="card-p">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5 flex-wrap">
            {/* Avatar preview */}
            <div className="relative">
              {previewUrl ? (
                <img src={previewUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-brand-200 dark:ring-brand-800"/>
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center ring-2 ring-brand-200 dark:ring-brand-800">
                  <span className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {avatarLoading && (
                <div className="absolute inset-0 rounded-full bg-slate-900/50 flex items-center justify-center">
                  <Spinner/>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden"/>
              <button onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}
                className="btn-secondary btn-sm">
                {previewUrl ? "Change photo" : "Upload photo"}
              </button>
              {previewUrl && (
                <button onClick={handleRemoveAvatar} disabled={avatarLoading} className="btn-danger btn-sm">
                  Remove photo
                </button>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG, WebP. Max 5 MB.</p>
            </div>
          </div>
        </div>

        {/* ── Profile info ─────────────────────────────────────────────────── */}
        <div className="card-p">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Personal Information</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required/>
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" value={user?.email || ""} className="input bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed" readOnly/>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Email cannot be changed.</p>
            </div>
            <div>
              <label className="label">Account role</label>
              <div className="input bg-slate-50 dark:bg-slate-700/50 capitalize text-slate-500 dark:text-slate-400">
                {user?.role}
              </div>
            </div>
            <button type="submit" disabled={profileLoading} className="btn-primary">
              {profileLoading ? <><Spinner/> Saving…</> : "Save changes"}
            </button>
          </form>
        </div>

        {/* ── Preferences ──────────────────────────────────────────────────── */}
        <div className="card-p">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Preferences</h2>
          <div className="space-y-4">
            {/* Dark mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark mode</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Switch between light and dark interface.</p>
              </div>
              <Toggle checked={isDark} onChange={handleDarkModeToggle}/>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700"/>
            {/* App notifications */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Broadcast App Notifications</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Receive browser notifications for new activity.</p>
              </div>
              <Toggle checked={appNotif} onChange={handleAppNotifToggle}/>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700"/>
            {/* Email notifications */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Email notifications</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Receive meeting reminders and OTPs via email.</p>
              </div>
              <Toggle checked={emailNotif} onChange={handleEmailNotifToggle}/>
            </div>
          </div>
        </div>

        {/* ── Change password ───────────────────────────────────────────────── */}
        <div className="card-p">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="label">Current password</label>
              <input type="password" value={pwForm.currentPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                className="input" placeholder="••••••••" required/>
            </div>
            <div>
              <label className="label">New password</label>
              <input type="password" value={pwForm.newPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                className="input" placeholder="Min. 6 characters" required/>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input type="password" value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                className="input" placeholder="Repeat new password" required/>
            </div>
            {pwForm.newPassword && pwForm.confirm && pwForm.newPassword !== pwForm.confirm && (
              <p className="text-xs text-red-500">Passwords do not match.</p>
            )}
            <button type="submit" disabled={pwLoading} className="btn-primary">
              {pwLoading ? <><Spinner/> Updating…</> : "Update password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

// Reusable toggle switch
const Toggle = ({ checked, onChange }) => (
  <button type="button" onClick={onChange} role="switch" aria-checked={checked}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
      checked ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"
    }`}>
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
      checked ? "translate-x-6" : "translate-x-1"
    }`}/>
  </button>
);
