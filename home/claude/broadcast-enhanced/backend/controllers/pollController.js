/**
 * Poll Controller
 * Admin: create, list all, close, delete, stats
 * Member/Both: list active, vote
 */
import mongoose from "mongoose";
import Poll from "../models/Poll.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";
import { z } from "zod";

// ── Inline validation schemas ─────────────────────────────────────────────────
const createSchema = z.object({
  question: z.string().trim().min(5).max(300),
  options: z
    .array(z.string().trim().min(1).max(200))
    .min(2, "At least 2 options required.")
    .max(8, "Maximum 8 options allowed."),
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

// ── Helper: notify all members about a new poll ───────────────────────────────
const notifyAllMembers = async (poll, io) => {
  const members = await User.find({ role: "member" }).select("_id");
  const notifDocs = members.map((m) => ({
    userId: m._id,
    type: "poll_created",
    title: "📊 New Poll",
    body: poll.question,
    refId: poll._id,
    refModel: "Poll",
    metadata: {},
  }));
  await Notification.insertMany(notifDocs);
  members.forEach((m) => {
    io.to(m._id.toString()).emit("new_poll", {
      pollId: poll._id,
      question: poll.question,
    });
  });
};

// ── Helper: shape poll for API response ───────────────────────────────────────
const shapePollForResponse = (poll, userId) => {
  const obj = poll.toObject ? poll.toObject() : { ...poll };

  let hasVoted = false;
  let votedOptionIndex = -1;

  // Calculate vote counts per option and detect user vote
  obj.options = obj.options.map((opt, idx) => {
    const voteCount = opt.votes ? opt.votes.length : 0;
    const userVoted = opt.votes?.some(
      (v) => v.userId?.toString() === userId?.toString()
    );
    if (userVoted) {
      hasVoted = true;
      votedOptionIndex = idx;
    }
    return {
      text: opt.text,
      voteCount,
      _id: opt._id,
    };
  });

  const totalVotes = obj.options.reduce((sum, o) => sum + o.voteCount, 0);

  return {
    ...obj,
    totalVotes,
    hasVoted,
    votedOptionIndex,
  };
};

// ── Admin: Create ─────────────────────────────────────────────────────────────
export const createPoll = async (req, res, next) => {
  try {
    const data = validate(createSchema, req.body);

    // Check for duplicate option texts
    const uniqueOptions = [...new Set(data.options)];
    if (uniqueOptions.length !== data.options.length) {
      return res.status(400).json({ success: false, message: "Duplicate options are not allowed." });
    }

    const poll = await Poll.create({
      question: data.question,
      options: data.options.map((text) => ({ text, votes: [] })),
      createdBy: req.user._id,
    });

    // Notify all members
    await notifyAllMembers(poll, getIO());

    const populated = await Poll.findById(poll._id).populate("createdBy", "name");
    res.status(201).json({ success: true, message: "Poll created.", poll: populated });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Get all polls (including closed) ───────────────────────────────────
export const getAdminPolls = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [polls, total] = await Promise.all([
      Poll.find({ isDeleted: false })
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Poll.countDocuments({ isDeleted: false }),
    ]);

    const userId = req.user._id.toString();
    const shaped = polls.map((p) => shapePollForResponse(p, userId));

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), polls: shaped });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Close poll ─────────────────────────────────────────────────────────
export const closePoll = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const poll = await Poll.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, status: "active" },
      { status: "closed", closedAt: new Date() },
      { new: true }
    ).populate("createdBy", "name");

    if (!poll) return res.status(404).json({ success: false, message: "Poll not found or already closed." });

    res.status(200).json({ success: true, message: "Poll closed.", poll: shapePollForResponse(poll, req.user._id.toString()) });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Delete (soft) ──────────────────────────────────────────────────────
export const deletePoll = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const poll = await Poll.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!poll) return res.status(404).json({ success: false, message: "Poll not found." });
    res.status(200).json({ success: true, message: "Poll deleted." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Get stats for a specific poll ──────────────────────────────────────
export const getPollStats = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const poll = await Poll.findById(req.params.id)
      .populate("options.votes.userId", "name email")
      .select("question options status createdAt closedAt");

    if (!poll) return res.status(404).json({ success: false, message: "Not found." });

    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
    const totalMembers = await User.countDocuments({ role: "member" });

    const options = poll.options.map((opt) => ({
      text: opt.text,
      voteCount: opt.votes.length,
      percentage: totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0,
      voters: opt.votes.map((v) => ({
        name: v.userId?.name || "—",
        email: v.userId?.email || "—",
        votedAt: v.votedAt,
      })),
    }));

    res.status(200).json({
      success: true,
      question: poll.question,
      status: poll.status,
      createdAt: poll.createdAt,
      closedAt: poll.closedAt,
      totalVotes,
      totalMembers,
      participationRate: totalMembers > 0 ? Math.round((totalVotes / totalMembers) * 100) : 0,
      options,
    });
  } catch (err) {
    next(err);
  }
};

// ── Both: Get polls ───────────────────────────────────────────────────────────
export const getAllPolls = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const isAdmin = req.user.role === "admin";

    const filter = { isDeleted: false };
    // Members only see active polls; admin sees all
    if (!isAdmin) filter.status = "active";

    const [polls, total] = await Promise.all([
      Poll.find(filter)
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Poll.countDocuments(filter),
    ]);

    const userId = req.user._id.toString();
    const shaped = polls.map((p) => shapePollForResponse(p, userId));

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), polls: shaped });
  } catch (err) {
    next(err);
  }
};

// ── Protected: Vote on a poll ─────────────────────────────────────────────────
export const votePoll = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ success: false, message: "optionIndex is required." });
    }

    const poll = await Poll.findOne({
      _id: req.params.id,
      isDeleted: false,
      status: "active",
    });

    if (!poll) return res.status(404).json({ success: false, message: "Poll not found or already closed." });

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ success: false, message: "Invalid option index." });
    }

    // Check if user already voted on ANY option
    const userId = req.user._id.toString();
    const alreadyVoted = poll.options.some((opt) =>
      opt.votes.some((v) => v.userId?.toString() === userId)
    );
    if (alreadyVoted) {
      return res.status(400).json({ success: false, message: "You have already voted on this poll." });
    }

    // Push vote
    poll.options[optionIndex].votes.push({
      userId: req.user._id,
      votedAt: new Date(),
    });
    await poll.save();

    // Emit live update to all connected users
    const io = getIO();
    const updatedPoll = await Poll.findById(poll._id).populate("createdBy", "name");
    const shaped = shapePollForResponse(updatedPoll, userId);

    // Broadcast vote update (without user-specific fields)
    const broadcastOptions = shaped.options.map((o) => ({
      text: o.text,
      voteCount: o.voteCount,
    }));
    io.emit("poll_vote_update", {
      pollId: poll._id,
      totalVotes: shaped.totalVotes,
      options: broadcastOptions,
    });

    res.status(200).json({ success: true, message: "Vote recorded.", poll: shaped });
  } catch (err) {
    next(err);
  }
};
