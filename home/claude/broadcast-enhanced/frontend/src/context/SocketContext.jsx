/**
 * Socket.IO Context — Enhanced
 * Provides socket instance + connection status to all components
 * Handles: online/offline tracking, auto-reconnect, auth
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import useAuthStore from "../store/useAuthStore";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuthStore();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  // Map of userId → { isOnline, lastSeen }
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setOnlineUsers({});
      }
      return;
    }
    if (socketRef.current?.connected) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => { setIsConnected(true); });
socket.on("disconnect", () => { setIsConnected(false); });
socket.on("connect_error", () => { setIsConnected(false); });

    // Track online status changes broadcast by server
    socket.on("user_status_change", ({ userId, isOnline, lastSeen }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: { isOnline, lastSeen: lastSeen || prev[userId]?.lastSeen } }));
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); socketRef.current = null; setIsConnected(false); };
  }, [isAuthenticated, token]);

  const isUserOnline = (userId) => onlineUsers[userId]?.isOnline || false;
  const getUserLastSeen = (userId) => onlineUsers[userId]?.lastSeen;

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, onlineUsers, isUserOnline, getUserLastSeen }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be inside SocketProvider");
  return ctx;
};
