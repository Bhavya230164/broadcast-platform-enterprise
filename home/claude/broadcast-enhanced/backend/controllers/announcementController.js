/**
 * Announcement Controller
 * Admin: create, edit, delete, pin, schedule
 * Member: list (respects schedule/expiry), mark read
 */
import mongoose from "mongoose";
import Announcement from "../models/Announcement.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";
import { z } from "zod";

// ── Inline validation schemas ─────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  content: z.string().trim().min(1).max(5000),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  isPinned: z.boolean().default(false),
  scheduledAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  targetGroups: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional().default([]),
});

const updateSchema = createSchema.partial();

const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = new Error(result.error.errors.map((e) => e.message).join(" | "));
    err.statusCode = 400;
    throw err;
  }
  return result.data;
};

// ── Helper: notify all members ────────────────────────────────────────────────
const notifyAllMembers = async (announcement, io) => {
  const members = await User.find({ role: "member" }).select("_id");
  const notifDocs = members.map((m) => ({
    userId: m._id,
    type: "system",
    title:
      announcement.priority === "urgent"
        ? "🚨 Urgent Announcement"
        : announcement.priority === "important"
        ? "⚠️ New Announcement"
        : "📢 New Announcement",
    body: announcement.title,
    refId: announcement._id,
    refModel: "Announcement",
    metadata: { priority: announcement.priority },
  }));
  await Notification.insertMany(notifDocs);
  members.forEach((m) => {
    io.to(m._id.toString()).emit("new_announcement", {
      announcementId: announcement._id,
      title: announcement.title,
      priority: announcement.priority,
    });
  });
};

// ── Admin: Create ──────────────────────────────────────────────────────────────
export const createAnnouncement = async (req, res, next) => {
  try {
    const data = validate(createSchema, req.body);
    const announcement = await Announcement.create({
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      createdBy: req.user._id,
      pinnedAt: data.isPinned ? new Date() : null,
    });

    // Only notify immediately if not scheduled for future
    const isLive = !data.scheduledAt || new Date(data.scheduledAt) <= new Date();
    if (isLive) {
      await notifyAllMembers(announcement, getIO());
    }

    res.status(201).json({ success: true, message: "Announcement created.", announcement });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Update ─────────────────────────────────────────────────────────────
export const updateAnnouncement = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const data = validate(updateSchema, req.body);
    const updateFields = { ...data };
    if ("scheduledAt" in data) updateFields.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if ("expiresAt" in data) updateFields.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.isPinned === true) updateFields.pinnedAt = new Date();
    if (data.isPinned === false) updateFields.pinnedAt = null;

    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate("createdBy", "name");

    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found." });
    res.status(200).json({ success: true, message: "Announcement updated.", announcement });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Delete (soft) ──────────────────────────────────────────────────────
export const deleteAnnouncement = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found." });
    res.status(200).json({ success: true, message: "Announcement deleted." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Toggle Pin ─────────────────────────────────────────────────────────
export const togglePin = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const ann = await Announcement.findOne({ _id: req.params.id, isDeleted: false });
    if (!ann) return res.status(404).json({ success: false, message: "Not found." });

    ann.isPinned = !ann.isPinned;
    ann.pinnedAt = ann.isPinned ? new Date() : null;
    await ann.save();

    res.status(200).json({ success: true, isPinned: ann.isPinned, message: ann.isPinned ? "Pinned." : "Unpinned." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Get all (including scheduled/expired) ──────────────────────────────
export const getAdminAnnouncements = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      Announcement.find({ isDeleted: false })
        .populate("createdBy", "name")
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments({ isDeleted: false }),
    ]);

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), announcements });
  } catch (err) {
    next(err);
  }
};

// ── Member: Get live announcements ────────────────────────────────────────────
export const getMemberAnnouncements = async (req, res, next) => {
  try {
    const now = new Date();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: false,
      // Either no schedule, or scheduled time has passed
      $or: [{ scheduledAt: null }, { scheduledAt: { $lte: now } }],
      // Either no expiry, or not yet expired
      $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }],
    };

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .populate("createdBy", "name")
        .select("-readBy") // don't expose all readers
        .sort({ isPinned: -1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments(filter),
    ]);

    // Inject per-user read status without exposing full readBy array
    const userId = req.user._id.toString();
    const shaped = await Promise.all(
      announcements.map(async (a) => {
        const raw = await Announcement.findById(a._id).select("readBy");
        const hasRead = raw.readBy.some((r) => r.userId?.toString() === userId);
        return { ...a.toObject(), hasRead };
      })
    );

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), announcements: shaped });
  } catch (err) {
    next(err);
  }
};

// ── Member: Mark as read ──────────────────────────────────────────────────────
export const markAnnouncementRead = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const already = await Announcement.findOne({
      _id: req.params.id,
      "readBy.userId": req.user._id,
    });
    if (already) return res.status(200).json({ success: true, message: "Already marked." });

    await Announcement.findByIdAndUpdate(req.params.id, {
      $push: { readBy: { userId: req.user._id, readAt: new Date() } },
    });
    res.status(200).json({ success: true, message: "Marked as read." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Read stats for a specific announcement ─────────────────────────────
export const getAnnouncementStats = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const ann = await Announcement.findById(req.params.id)
      .populate("readBy.userId", "name email")
      .select("title readBy");
    if (!ann) return res.status(404).json({ success: false, message: "Not found." });

    const totalMembers = await User.countDocuments({ role: "member" });
    res.status(200).json({
      success: true,
      title: ann.title,
      totalMembers,
      readCount: ann.readBy.length,
      readers: ann.readBy,
    });
  } catch (err) {
    next(err);
  }
};
