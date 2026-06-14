import { useEffect } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import usePrivateChatStore from "../../store/usePrivateChatStore";

const showBrowserNotification = (title, body) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
};

export default function RealtimeNotifications() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const receiveMessage = usePrivateChatStore((state) => state.receiveMessage);
  const activeChatUser = usePrivateChatStore((state) => state.activeChatUser);

  useEffect(() => {
    if (!socket) return;

    const handlePrivateMessage = (message) => {
      const senderName = message.senderId?.name || "New message";
      const senderId = message.senderId?._id || message.senderId;
      const preview = message.content || (message.attachments?.length ? "Attachment received" : "");

      if (location.pathname !== "/private-chat" && (!activeChatUser || activeChatUser._id !== senderId)) {
        receiveMessage(message);
      }

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              navigate("/private-chat");
            }}
            className="text-left"
          >
            <div className="font-medium text-sm text-slate-900 dark:text-white">{senderName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 line-clamp-2">{preview}</div>
          </button>
        ),
        { duration: 6000 }
      );
      showBrowserNotification(senderName, preview);
    };

    const handleNotification = (notification) => {
      window.dispatchEvent(new CustomEvent("notification:created", { detail: notification }));
    };

    socket.on("receive_private_message", handlePrivateMessage);
    socket.on("notification_created", handleNotification);

    return () => {
      socket.off("receive_private_message", handlePrivateMessage);
      socket.off("notification_created", handleNotification);
    };
  }, [socket, navigate, receiveMessage, activeChatUser, location.pathname]);

  return null;
}
