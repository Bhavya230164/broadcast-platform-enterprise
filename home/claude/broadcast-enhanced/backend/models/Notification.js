/**
 * Notification Model
 * Persists all real-time notifications so users see them after reconnecting.
 */

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        // Messages
        "new_message",
        "private_message",
        "message_pinned",

        // Meetings
        "meeting_scheduled",
        "meeting_reminder",
        "meeting_cancelled",

        // Tasks
        "task_assigned",
        "task_updated",
        "task_completed",

        // Announcements
        "announcement_created",

        // Leadership Corner
        "leadership_post",

        // Knowledge Base
        "kb_document_added",

        // Polls
        "poll_created",
        "poll_voted",

        // Calls
        "incoming_call",
        "missed_call",

        // Generic
        "system",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 120,
      trim: true,
    },

    body: {
      type: String,
      default: "",
      maxlength: 500,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    // Related document reference
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    refModel: {
      type: String,
      enum: [
        "Message",
        "Meeting",
        "Task",
        "Announcement",
        "LeadershipPost",
        "KBDocument",
        "Poll",
        "PrivateMessage",
        "CallHistory",
        null,
      ],
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({
  userId: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index({
  userId: 1,
  type: 1,
});

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;
