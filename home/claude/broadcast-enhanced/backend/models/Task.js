/**
 * Task Model — Employee Task Assignment
 * Features: admin assigns, due dates, status tracking, notifications
 */
import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required."],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters."],
      default: "",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Task must be assigned to a member."],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Optional group context
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal",
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required."],
    },
    // Status is computed but also stored for efficient querying
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "overdue"],
      default: "pending",
    },
    completedAt: { type: Date, default: null },
    // Progress 0-100 — member can update this
    progress: { type: Number, min: 0, max: 100, default: 0 },
    // Member notes / update
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters."],
      default: "",
    },
    // Reminder sent flags
    reminderSent24h: { type: Boolean, default: false },
    reminderSent1h: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedBy: 1, createdAt: -1 });
taskSchema.index({ dueDate: 1, status: 1 }); // for overdue cron

const Task = mongoose.model("Task", taskSchema);
export default Task;
