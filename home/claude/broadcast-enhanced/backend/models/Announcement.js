/**
 * Announcement Model — Announcement Center
 * Features: priority, scheduled publish, pin, expiry, per-user read tracking
 */
import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      maxlength: [160, "Title cannot exceed 160 characters."],
    },
    content: {
      type: String,
      required: [true, "Content is required."],
      trim: true,
      maxlength: [5000, "Content cannot exceed 5000 characters."],
    },
    // Who created it — must be admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    priority: {
      type: String,
      enum: ["normal", "important", "urgent"],
      default: "normal",
    },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },

    // If scheduledAt is in the future, it won't appear in member feeds until then
    scheduledAt: { type: Date, default: null },
    // After expiresAt it disappears from member feed (null = never expires)
    expiresAt: { type: Date, default: null },

    // Audience: [] means ALL members. Populated = targeted groups/members
    targetGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],

    // Per-member read tracking
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    isDeleted: { type: Boolean, default: false }, // soft delete
  },
  { timestamps: true }
);

announcementSchema.index({ isPinned: -1, scheduledAt: 1, createdAt: -1 });
announcementSchema.index({ expiresAt: 1 });
announcementSchema.index({ "readBy.userId": 1 });

const Announcement = mongoose.model("Announcement", announcementSchema);
export default Announcement;
