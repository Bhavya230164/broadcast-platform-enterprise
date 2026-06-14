/**
 * Task Controller — Employee Task Assignment
 * Admin: CRUD, assign, view all
 * Member: view own tasks, update progress/notes, mark complete
 */
import mongoose from "mongoose";
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  assignedTo: z.string().regex(/^[a-f\d]{24}$/i, "Invalid member ID."),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid due date."),
  groupId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
});

const updateAdminSchema = createSchema.partial();

const updateMemberSchema = z.object({
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
});

const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = new Error(result.error.errors.map((e) => e.message).join(" | "));
    err.statusCode = 400;
    throw err;
  }
  return result.data;
};

// ── Compute effective status ──────────────────────────────────────────────────
const computeStatus = (task) => {
  if (task.status === "completed") return "completed";
  if (new Date() > new Date(task.dueDate)) return "overdue";
  return task.status;
};

// ── Admin: Create task ────────────────────────────────────────────────────────
export const createTask = async (req, res, next) => {
  try {
    const data = validate(createSchema, req.body);

    // Verify assignee exists and is a member
    const assignee = await User.findOne({ _id: data.assignedTo, role: "member" });
    if (!assignee) return res.status(404).json({ success: false, message: "Member not found." });

    const task = await Task.create({
      ...data,
      dueDate: new Date(data.dueDate),
      groupId: data.groupId || null,
      assignedBy: req.user._id,
    });

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("assignedBy", "name");

    // Notify assignee
    await Notification.create({
      userId: assignee._id,
      type: "system",
      title: `📋 New Task Assigned: ${task.title}`,
      body: `Due: ${new Date(task.dueDate).toLocaleDateString()}. Priority: ${task.priority}.`,
      refId: task._id,
      refModel: "Task",
      metadata: { priority: task.priority, dueDate: task.dueDate },
    });

    getIO().to(assignee._id.toString()).emit("task_assigned", {
      taskId: task._id,
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
    });

    res.status(201).json({ success: true, message: "Task created and assigned.", task: populated });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Update task ────────────────────────────────────────────────────────
export const updateTask = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const data = validate(updateAdminSchema, req.body);
    if (data.dueDate) data.dueDate = new Date(data.dueDate);

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).populate("assignedTo", "name email").populate("assignedBy", "name");

    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    res.status(200).json({ success: true, message: "Task updated.", task });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Delete task ────────────────────────────────────────────────────────
export const deleteTask = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });
    res.status(200).json({ success: true, message: "Task deleted." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Get all tasks (with filters) ──────────────────────────────────────
export const getAllTasks = async (req, res, next) => {
  try {
    const { status, assignedTo, priority, page = 1, limit = 30 } = req.query;
    const filter = { isDeleted: false };
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) filter.assignedTo = assignedTo;
    if (priority) filter.priority = priority;

    // First mark overdue tasks
    await Task.updateMany(
      { isDeleted: false, status: { $in: ["pending", "in_progress"] }, dueDate: { $lt: new Date() } },
      { status: "overdue" }
    );

    if (status) filter.status = status;

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
    const lim = Math.min(50, parseInt(limit));

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate("assignedTo", "name email avatar")
        .populate("assignedBy", "name")
        .sort({ dueDate: 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(lim),
      Task.countDocuments(filter),
    ]);

    // Summary stats
    const stats = await Task.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const summary = stats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});

    res.status(200).json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / lim), summary, tasks });
  } catch (err) {
    next(err);
  }
};

// ── Member: Get my tasks ──────────────────────────────────────────────────────
export const getMyTasks = async (req, res, next) => {
  try {
    // Mark overdue for this user
    await Task.updateMany(
      { assignedTo: req.user._id, isDeleted: false, status: { $in: ["pending", "in_progress"] }, dueDate: { $lt: new Date() } },
      { status: "overdue" }
    );

    const { status } = req.query;
    const filter = { assignedTo: req.user._id, isDeleted: false };
    if (status) filter.status = status;

    const tasks = await Task.find(filter)
      .populate("assignedBy", "name")
      .sort({ dueDate: 1, priority: -1 });

    const summary = { pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    tasks.forEach((t) => { if (summary[t.status] !== undefined) summary[t.status]++; });

    res.status(200).json({ success: true, count: tasks.length, summary, tasks });
  } catch (err) {
    next(err);
  }
};

// ── Member: Update own task (progress, notes, status) ────────────────────────
export const updateMyTask = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const data = validate(updateMemberSchema, req.body);
    const updateFields = { ...data };

    // Auto-set completedAt when status becomes completed
    if (data.status === "completed") {
      updateFields.completedAt = new Date();
      updateFields.progress = 100;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user._id, isDeleted: false },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate("assignedBy", "name");

    if (!task) return res.status(404).json({ success: false, message: "Task not found or not assigned to you." });

    // Notify admin on completion
    if (data.status === "completed") {
      const adminUser = await User.findById(task.assignedBy._id || task.assignedBy);
      if (adminUser) {
        await Notification.create({
          userId: adminUser._id,
          type: "system",
          title: `✅ Task Completed: ${task.title}`,
          body: `Completed by ${req.user.name}.`,
          refId: task._id,
          refModel: "Task",
        });
        getIO().to(adminUser._id.toString()).emit("task_completed", {
          taskId: task._id,
          title: task.title,
          completedBy: req.user.name,
        });
      }
    }

    res.status(200).json({ success: true, message: "Task updated.", task });
  } catch (err) {
    next(err);
  }
};
