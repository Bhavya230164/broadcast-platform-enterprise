import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";

import { Home, MessageSquare, Video, Calendar } from 'lucide-react';

export default function BottomNav() {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const tabs = [
    { name: "Home", to: user?.role === "admin" ? "/admin" : "/dashboard", icon: <Home size={24} /> },
    { name: "Chats", to: "/private-chat", icon: <MessageSquare size={24} /> },
    { name: "Meetings", to: "/meetings", icon: <Video size={24} /> },
    { name: "Calendar", to: "/calendar", icon: <Calendar size={24} /> },
  ];

  return (
    <>



      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-50 pb-safe sm:hidden block">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.name}
                to={tab.to}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <span className="leading-none">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
