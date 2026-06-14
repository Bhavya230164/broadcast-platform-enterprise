/**
 * Meeting Model
 * Features: schedule, reminders, Google Meet / Zoom links, group targeting
 */
import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Meeting title is required."],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters."],
      default: "",
    },
    scheduledAt: {
      type: Date,
      required: [true, "Meeting date/time is required."],
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: [5, "Duration must be at least 5 minutes."],
      max: [480, "Duration cannot exceed 8 hours."],
    },
    // Who created this meeting (must be admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Which group this meeting is for
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    // Specific invitees (empty = all group members)
    invitees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Join Link ──────────────────────────────────────────────────────────────
    meetingLink: {
      type: String,
      trim: true,
      default: "",
      // Accepts Google Meet, Zoom, Teams, or any URL
    },
    platform: {
      type: String,
      enum: ["google_meet", "zoom", "teams", "other"],
      default: "other",
    },

    // ── Reminders ─────────────────────────────────────────────────────────────
    reminders: [
      {
        minutesBefore: { type: Number },        // e.g. 60, 30, 15, 5
        sentAt: { type: Date, default: null },   // null = not sent yet
      },
    ],

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled"],
      default: "scheduled",
    },

    // Track who has joined (clicked Join button)
    joinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

meetingSchema.index({ groupId: 1, scheduledAt: 1 });
meetingSchema.index({ invitees: 1, scheduledAt: 1 });
meetingSchema.index({ createdBy: 1 });

const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
