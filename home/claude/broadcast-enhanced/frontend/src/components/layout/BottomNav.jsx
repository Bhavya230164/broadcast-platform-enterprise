import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";

export default function BottomNav() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // Hide BottomNav if not authenticated or if we are on pages that shouldn't have it (like login, register)
  if (!isAuthenticated) return null;

  const tabs = [
    { name: "Home", to: "/home", icon: null, imgSrc: "/icons/home-icon.png" },
    { name: "Chats", to: "/chats", icon: "💬", imgSrc: null },
    { name: "Meetings", to: "/meetings", icon: null, imgSrc: "/icons/meeting-icon.png" },
    { name: "Calendar", to: "/calendar", icon: "🗓️", imgSrc: null },
  ];

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the fixed navbar */}
      <div className="h-16 pb-safe sm:hidden block"></div>

      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-50 pb-safe sm:hidden block">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const isActive = tab.to === "/home"
              ? ["/home", "/admin", "/dashboard"].includes(location.pathname)
              : location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.name}
                to={tab.to}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                {tab.imgSrc ? (
                  <img
                    src={tab.imgSrc}
                    alt={tab.name}
                    className="w-6 h-6 object-contain"
                  />
                ) : (
                  <span className="text-xl leading-none">{tab.icon}</span>
                )}
                <span className="text-[10px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
