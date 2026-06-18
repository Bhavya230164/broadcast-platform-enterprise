import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import useAuthStore from "../../store/useAuthStore";
import { useSocket } from "../../context/SocketContext";
import usePrivateChatStore from "../../store/usePrivateChatStore";

export default function BottomNav() {
  const { isAuthenticated } = useAuthStore();
  const { socket, isConnected } = useSocket();
  const {
    unreadTotal,
    fetchUsers,
    setChatPageOpen,
    markMessagesReadByOther,
    updateUserStatus,
  } = usePrivateChatStore();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) fetchUsers();
  }, [isAuthenticated, fetchUsers]);

  useEffect(() => {
    setChatPageOpen(location.pathname.startsWith("/chats") || location.pathname.startsWith("/private-chat"));
  }, [location.pathname, setChatPageOpen]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReadReceipt = ({ readerId }) => {
      markMessagesReadByOther(readerId);
    };

    socket.on("private_read_receipt", handleReadReceipt);
    socket.on("user_status_change", updateUserStatus);

    return () => {
      socket.off("private_read_receipt", handleReadReceipt);
      socket.off("user_status_change", updateUserStatus);
    };
  }, [socket, isConnected, markMessagesReadByOther, updateUserStatus]);

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
                  <span className="relative text-xl leading-none">
                    {tab.icon}
                    {tab.name === "Chats" && unreadTotal > 0 && !isActive && (
                      <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center shadow-sm">
                        {unreadTotal > 99 ? "99+" : unreadTotal}
                      </span>
                    )}
                  </span>
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
