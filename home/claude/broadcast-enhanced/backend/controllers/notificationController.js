/**
 * Notification Controller
 * Features: get all, get unread count, mark read, mark all read, delete
 */
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

// ── Get Notifications ──────────────────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
      Notification.countDocuments({ userId: req.user._id }),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    res.status(200).json({ success: true, total, unreadCount, page, pages: Math.ceil(total / limit), notifications });
  } catch (err) { next(err); }
};

// ── Get Unread Count ───────────────────────────────────────────────────────────
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.status(200).json({ success: true, unreadCount: count });
  } catch (err) { next(err); }
};

// ── Mark Single as Read ────────────────────────────────────────────────────────
export const markAsRead = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { isRead: true });
    res.status(200).json({ success: true, message: "Notification marked as read." });
  } catch (err) { next(err); }
};

// ── Mark All as Read ───────────────────────────────────────────────────────────
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (err) { next(err); }
};

// ── Delete Notification ────────────────────────────────────────────────────────
export const deleteNotification = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (err) { next(err); }
};
