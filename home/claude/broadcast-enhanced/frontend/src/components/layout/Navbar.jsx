/**
 * Navbar — Extended with enterprise feature navigation links
 * All existing functionality preserved.
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import { useSocket } from "../../context/SocketContext";
import { notificationService, profileService } from "../../services/api";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const UserAvatar = ({ user, size = "md" }) => {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-14 h-14 text-lg", xl: "w-24 h-24 text-3xl" };
  if (user?.avatar?.url)
    return <img src={`${API_BASE}${user.avatar.url}`} alt={user.name} className={`avatar ${sizes[size]}`}/>;
  return (
    <div className={`avatar-placeholder ${sizes[size]}`}>
      {user?.name?.charAt(0).toUpperCase() || "?"}
    </div>
  );
};

// Enterprise nav links visible to both roles
const ENTERPRISE_LINKS = [
  { to: "/announcements",  label: "Announcements", icon: "📢" },
  { to: "/knowledge-base", label: "Knowledge Base", icon: "📚" },
  { to: "/tasks",          label: "Tasks",          icon: "📋" },
  { to: "/leadership",     label: "Leadership",     icon: "🏢" },
  { to: "/polls",          label: "Polls",          icon: "📊" },
  { to: "/call-history",   label: "Call History",   icon: "📞" },
];

export default function Navbar() {
  const { user, logout, setDarkMode } = useAuthStore();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const menuRef = useRef(null);
  const enterpriseRef = useRef(null);

  useEffect(() => {
    notificationService.getUnreadCount().then(({ data }) => setUnreadCount(data.unreadCount || 0)).catch(() => {});
    const interval = setInterval(() => {
      notificationService.getUnreadCount().then(({ data }) => setUnreadCount(data.unreadCount || 0)).catch(() => {});
    }, 30000);
    const handleRealtimeNotification = () => setUnreadCount((count) => count + 1);
    window.addEventListener("notification:created", handleRealtimeNotification);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification:created", handleRealtimeNotification);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (enterpriseRef.current && !enterpriseRef.current.contains(e.target)) setEnterpriseOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  const handleDarkModeToggle = async () => {
    try {
      const newVal = !user?.preferences?.darkMode;
      await profileService.toggleDarkMode();
      setDarkMode(newVal);
      toast.success(newVal ? "Dark mode on" : "Light mode on");
    } catch { toast.error("Could not update preference."); }
  };

  const isDark = user?.preferences?.darkMode;
  const isEnterpriseActive = ENTERPRISE_LINKS.some((l) => location.pathname.startsWith(l.to));

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a9 9 0 010 12.728 1 1 0 11-1.414-1.414 7 7 0 000-9.9 1 1 0 011.414-1.414zM10 9a1 1 0 110 2 1 1 0 010-2z"/>
            </svg>
          </div>
          <span className="font-semibold text-slate-900 dark:text-white hidden sm:block">Broadcast</span>
          {user?.role === "admin" && (
            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 text-[10px] tracking-wider hidden sm:inline-flex">ADMIN</span>
          )}
        </Link>

        {/* Centre nav: Enterprise dropdown */}
        <div className="flex-1 flex justify-center">
          <div className="relative" ref={enterpriseRef}>
            <button
              onClick={() => setEnterpriseOpen((p) => !p)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isEnterpriseActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              Enterprise
              <svg className={`w-3 h-3 transition-transform ${enterpriseOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {enterpriseOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 animate-fade-in z-50">
                <div className="px-3 py-1.5 mb-1">
                  <p className="section-title">Enterprise Features</p>
                </div>
                {ENTERPRISE_LINKS.map((link) => (
                  <Link key={link.to} to={link.to}
                    onClick={() => setEnterpriseOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      location.pathname.startsWith(link.to)
                        ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}>
                    <span className="text-base">{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" title={isConnected ? "Connected" : "Disconnected"}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-300"} animate-pulse`}/>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">{isConnected ? "Live" : "Offline"}</span>
          </div>

          {/* Dark mode */}
          <button onClick={handleDarkModeToggle} className="btn-ghost btn-icon" title={isDark ? "Light mode" : "Dark mode"}>
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            )}
          </button>

          {/* Notification bell */}
          <Link to={user?.role === "admin" ? "/admin" : "/dashboard"} className="btn-ghost btn-icon relative">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((p) => !p)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <UserAvatar user={user} size="sm"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block max-w-[100px] truncate">{user?.name}</span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 animate-fade-in z-50">
                {/* Mobile enterprise links */}
                <div className="sm:hidden px-3 py-1.5">
                  <p className="section-title">Enterprise</p>
                </div>
                {ENTERPRISE_LINKS.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
                    className="sm:hidden flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    {link.icon} {link.label}
                  </Link>
                ))}
                <div className="sm:hidden border-t border-slate-100 dark:border-slate-700 my-1"/>

                <Link to="/profile" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Profile
                </Link>
                <Link to="/2fa-setup" onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  Security (2FA)
                </Link>
                <div className="border-t border-slate-100 dark:border-slate-700 my-1"/>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
