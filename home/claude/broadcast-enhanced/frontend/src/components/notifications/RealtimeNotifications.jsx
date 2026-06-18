import { useEffect } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import usePrivateChatStore from "../../store/usePrivateChatStore";
import useAuthStore from "../../store/useAuthStore";

const showBrowserNotification = (title, body, enabled) => {
  if (!("Notification" in window)) return;
  if (!enabled || Notification.permission !== "granted") return;
    new Notification(title, { body });
};

export default function RealtimeNotifications() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const receiveMessage = usePrivateChatStore((state) => state.receiveMessage);
  const activeChatUser = usePrivateChatStore((state) => state.activeChatUser);
  const appNotificationsEnabled = user?.preferences?.appNotifications !== false;

  useEffect(() => {
    if (!socket) return;

    const handlePrivateMessage = (message) => {
      const senderName = message.senderId?.name || "New message";
      const senderId = message.senderId?._id || message.senderId;
      const preview = message.content || (message.attachments?.length ? "Attachment received" : "");
      const isActiveChat = ["/private-chat", "/chats"].includes(location.pathname) && activeChatUser?._id === senderId;

      receiveMessage(message);

      if (isActiveChat) {
        socket.emit("private_read", { senderId });
      }

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              navigate("/chats");
            }}
            className="text-left"
          >
            <div className="font-medium text-sm text-slate-900 dark:text-white">{senderName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 line-clamp-2">{preview}</div>
          </button>
        ),
        { duration: 6000 }
      );
      showBrowserNotification(senderName, preview, appNotificationsEnabled);
    };

    const handleNotification = (notification) => {
      window.dispatchEvent(new CustomEvent("notification:created", { detail: notification }));
    };

    const handleNotificationUpdated = () => {
      window.dispatchEvent(new CustomEvent("notification:updated"));
    };

    socket.on("receive_private_message", handlePrivateMessage);
    socket.on("notification_created", handleNotification);
    socket.on("notification_updated", handleNotificationUpdated);

    return () => {
      socket.off("receive_private_message", handlePrivateMessage);
      socket.off("notification_created", handleNotification);
      socket.off("notification_updated", handleNotificationUpdated);
    };
  }, [socket, navigate, receiveMessage, activeChatUser, location.pathname, appNotificationsEnabled]);

  return null;
}
