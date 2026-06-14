/**
 * server.js — Broadcast Platform (Enterprise Edition)
 * Preserves ALL existing routes. Adds 4 enterprise feature routes.
 */
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db.js";
import { initSocket } from "./config/socket.js";

// ── Existing routes (UNCHANGED) ───────────────────────────────────────────────
import authRoutes from "./routes/authRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";

// ── New enterprise routes ─────────────────────────────────────────────────────
import announcementRoutes from "./routes/announcementRoutes.js";
import kbRoutes from "./routes/kbRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import leadershipRoutes from "./routes/leadershipRoutes.js";
import pollRoutes from "./routes/pollRoutes.js";
import privateMessageRoutes from "./routes/privateMessageRoutes.js";
import callHistoryRoutes from "./routes/callHistoryRoutes.js";

// Removed conflicting notification import

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({ origin: "*", credentials: true }));

const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));

// ── Static files (all upload dirs) ────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ success: true, message: "API healthy.", timestamp: new Date().toISOString() })
);

// ── Existing API routes (PRESERVED UNCHANGED) ──────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/profile", profileRoutes);

// ── New enterprise API routes ─────────────────────────────────────────────────
app.use("/api/announcements", announcementRoutes);
app.use("/api/kb", kbRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/leadership", leadershipRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/private-messages", privateMessageRoutes);
app.use("/api/call-history", callHistoryRoutes);

// Removed conflicting notification route usage
app.use(cors({ origin: "*", credentials: true }));


// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Broadcast Platform Backend Running",
  });
});

// ── HTTP + Socket.IO Server initialization ─────────────────────────────────────
const httpServer = http.createServer(app);
initSocket(httpServer);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\n[Server] Running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`[Server] API: http://localhost:${PORT}/api`);
  console.log(`[Server] Uploads: http://localhost:${PORT}/uploads\n`);
});

export default app;
