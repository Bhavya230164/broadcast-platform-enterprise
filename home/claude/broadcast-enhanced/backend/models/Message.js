/**
 * Message Model — Enhanced
 * Adds: priority, pinned, acknowledgements, attachments, delivery receipts
 */
import mongoose from "mongoose";

// Per-receiver delivery/read tracking
const receiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deliveredAt: { type: Date, default: null },  // socket connected, message pushed
    readAt: { type: Date, default: null },        // user opened their inbox
    acknowledgedAt: { type: Date, default: null }, // user clicked "I Have Read"
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Message must belong to a group."],
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Message must have a sender."],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters."],
      default: "",
    },
    // broadcast = all group members | selective = chosen subset
    type: {
      type: String,
      enum: ["broadcast", "selective"],
      default: "broadcast",
    },
    // ── Priority ───────────────────────────────────────────────────────────────
    priority: {
      type: String,
      enum: ["normal", "important", "urgent"],
      default: "normal",
    },
    // ── Pinned ────────────────────────────────────────────────────────────────
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ── Receivers (authorized viewers) ────────────────────────────────────────
    receivers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Enhanced receipts (replaces old readBy array) ──────────────────────────
    receipts: [receiptSchema],

    // ── Attachments (images, PDFs, docs) ──────────────────────────────────────
    attachments: [
      {
        originalName: String,    // original filename from user
        filename: String,         // stored filename on disk
        url: String,              // /uploads/files/xxx
        mimetype: String,         // image/jpeg, application/pdf, etc.
        size: Number,             // bytes
        fileType: {               // category for UI rendering
          type: String,
          enum: ["image", "pdf", "document", "other"],
          default: "other",
        },
      },
    ],

    // ── Notification tracking ──────────────────────────────────────────────────
    notifiedViaSocket: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast inbox query: all messages for a receiver
messageSchema.index({ receivers: 1, createdAt: -1 });
// Admin group history
messageSchema.index({ groupId: 1, createdAt: -1 });
// Pinned messages
messageSchema.index({ groupId: 1, isPinned: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
