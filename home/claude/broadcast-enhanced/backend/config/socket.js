/**
 * Socket.IO Config - Enhanced
 * Features: JWT auth, private rooms, online/offline tracking,
 * real-time notifications, read receipts, typing status, and WebRTC calls.
 */
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import CallHistory from "../models/CallHistory.js";
import Notification from "../models/Notification.js";

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("SOCKET_AUTH_FAILED: No token."));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch {
      return next(new Error("SOCKET_AUTH_FAILED: Invalid token."));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.id;

    socket.join(userId.toString());
    console.log(`[Socket.IO] Connected: user=${userId} socket=${socket.id}`);

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      io.emit("user_status_change", { userId, isOnline: true });
    } catch (e) {
      console.error("[Socket.IO] Failed to set online status:", e.message);
    }

    socket.on("mark_delivered", ({ messageId }) => {
      socket.emit("delivery_confirmed", { messageId });
    });

    socket.on("private_typing", ({ receiverId, isTyping }) => {
      io.to(receiverId.toString()).emit("private_typing", { senderId: userId, isTyping });
    });

    socket.on("private_read", ({ senderId }) => {
      io.to(senderId.toString()).emit("private_read_receipt", { readerId: userId });
    });

    socket.on("call_user", async ({ userToCall, signalData, from, type }) => {
      try {
        const call = await CallHistory.create({
          caller: from?._id || userId,
          receiver: userToCall,
          type,
          status: "missed",
          duration: 0,
        });

        const notification = await Notification.create({
          userId: userToCall,
          type: "incoming_call",
          title: `Incoming ${type === "video" ? "video" : "voice"} call`,
          body: `${from?.name || "Someone"} is calling you`,
          refId: call._id,
          refModel: "CallHistory",
          metadata: {
            callId: call._id,
            callerId: from?._id || userId,
            callerName: from?.name,
            type,
          },
        });

        io.to(userToCall.toString()).emit("incoming_call", {
          signal: signalData,
          from,
          type,
          callId: call._id,
        });
        socket.emit("call_started", { callId: call._id });
        io.to(userToCall.toString()).emit("notification_created", notification);
      } catch (err) {
        console.error("[Socket.IO] call_user error:", err.message);
      }
    });

    socket.on("answer_call", async ({ to, signal, callId }) => {
      try {
        if (callId) {
          await CallHistory.findByIdAndUpdate(callId, { status: "answered", answeredAt: new Date() });
        }

        io.to(to.toString()).emit("call_accepted", { signal, callId });
      } catch (err) {
        console.error("[Socket.IO] answer_call error:", err.message);
      }
    });

    socket.on("reject_call", async ({ to, callId }) => {
      try {
        if (callId) {
          await CallHistory.findByIdAndUpdate(callId, { status: "rejected", endedAt: new Date() });
        }

        io.to(to.toString()).emit("call_rejected", { callId });
      } catch (err) {
        console.error("[Socket.IO] reject_call error:", err.message);
      }
    });

    socket.on("end_call", async ({ to, callId, duration = 0, status = "completed" }) => {
      try {
        if (callId) {
          const nextStatus = ["missed", "answered", "rejected", "completed"].includes(status)
            ? status
            : "completed";
          const call = await CallHistory.findByIdAndUpdate(callId, {
            status: nextStatus,
            duration,
            endedAt: new Date(),
          }).populate("caller", "name");

          if (nextStatus === "missed" && call) {
            const notification = await Notification.create({
              userId: call.receiver,
              type: "missed_call",
              title: `Missed ${call.type === "video" ? "video" : "voice"} call`,
              body: `${call.caller?.name || "Someone"} called you`,
              refId: call._id,
              refModel: "CallHistory",
              metadata: {
                callId: call._id,
                callerId: call.caller?._id,
                callerName: call.caller?.name,
                type: call.type,
              },
            });
            io.to(call.receiver.toString()).emit("notification_created", notification);
          }
        }

        io.to(to.toString()).emit("call_ended", { callId });
      } catch (err) {
        console.error("[Socket.IO] end_call error:", err.message);
      }
    });

    socket.on("ice_candidate", ({ to, candidate }) => {
      if (to && candidate) {
        io.to(to.toString()).emit("ice_candidate", { from: userId, candidate });
      }
    });

    socket.on("disconnect", async (reason) => {
      console.log(`[Socket.IO] Disconnected: user=${userId} reason=${reason}`);

      try {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        io.emit("user_status_change", { userId, isOnline: false, lastSeen: new Date() });
      } catch (e) {
        console.error("[Socket.IO] Failed to set offline status:", e.message);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("[Socket.IO] Not initialized. Call initSocket() first.");
  }

  return io;
};

export const emitToUser = (userId, event, data) => {
  getIO().to(userId.toString()).emit(event, data);
};

export const emitToUsers = (userIds, event, data) => {
  const ioInstance = getIO();

  userIds.forEach((uid) => {
    ioInstance.to(uid.toString()).emit(event, data);
  });
};
