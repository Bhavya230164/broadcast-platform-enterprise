/**
 * Leadership Controller — CEO / Leadership Corner
 * Admin: create, edit, delete, pin posts
 * Member: view, acknowledge (no replies)
 */
import mongoose from "mongoose";
import LeadershipPost from "../models/LeadershipPost.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(3).max(200),

  content: z.string().trim().min(1).max(10000),

  postType: z
    .enum([
      "ceo_message",
      "company_vision",
      "goals",
      "leadership_update",
      "general",
    ])
    .default("general"),

  authorLabel: z.string().trim().max(100).optional().default(""),

  isPinned: z.preprocess(
    (value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    },
    z.boolean().optional().default(false)
  ),
});


const updateSchema = createSchema.partial();

const validate = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const messages = result.error.issues.map(
      (e) => `${e.path.join(".")} : ${e.message}`
    );

    const err = new Error(messages.join(" | "));
    err.statusCode = 400;
    throw err;
  }

  return result.data;
};
const POST_TYPE_LABELS = {
  ceo_message: "CEO Message",
  company_vision: "Company Vision",
  goals: "Goals & Strategy",
  leadership_update: "Leadership Update",
  general: "General",
};

// ── Admin: Create post ────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
        console.log("CREATE BODY:", req.body);

    if (req.body.isPinned !== undefined) {
      req.body.isPinned =
        req.body.isPinned === true ||
        req.body.isPinned === "true";
    }
    const data = validate(createSchema, req.body);

    // Handle optional featured image
    const featuredImage = req.file
      ? { url: `/uploads/leadership/${req.file.filename}`, filename: req.file.filename }
      : { url: null, filename: null };

    const post = await LeadershipPost.create({
      ...data,
      createdBy: req.user._id,
      pinnedAt: data.isPinned ? new Date() : null,
      featuredImage,
    });

    const populated = await LeadershipPost.findById(post._id).populate("createdBy", "name role");

    // Notify all members
    const members = await User.find({ role: "member" }).select("_id");
    const notifDocs = members.map((m) => ({
      userId: m._id,
      type: "system",
      title: `🏢 ${POST_TYPE_LABELS[data.postType] || "Leadership Update"}`,
      body: data.title,
      refId: post._id,
      refModel: "LeadershipPost",
      metadata: { postType: data.postType },
    }));
    await Notification.insertMany(notifDocs);

    members.forEach((m) => {
      getIO().to(m._id.toString()).emit("new_leadership_post", {
        postId: post._id,
        title: data.title,
        postType: data.postType,
        authorLabel: data.authorLabel,
      });
    });

    res.status(201).json({ success: true, message: "Leadership post created.", post: populated });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Update post ────────────────────────────────────────────────────────
export const updatePost = async (req, res, next) => {
  try {
     console.log("UPDATE BODY:", req.body);

    if (req.body.isPinned !== undefined) {
      req.body.isPinned =
        req.body.isPinned === true ||
        req.body.isPinned === "true";
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const data = validate(updateSchema, req.body);
    const updateFields = { ...data };
    if (data.isPinned === true) updateFields.pinnedAt = new Date();
    if (data.isPinned === false) updateFields.pinnedAt = null;

    if (req.file) {
      updateFields.featuredImage = {
        url: `/uploads/leadership/${req.file.filename}`,
        filename: req.file.filename,
      };
    }

    const post = await LeadershipPost.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate("createdBy", "name role");

    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    res.status(200).json({ success: true, message: "Post updated.", post });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Delete (soft) ──────────────────────────────────────────────────────
export const deletePost = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const post = await LeadershipPost.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    res.status(200).json({ success: true, message: "Post deleted." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Toggle pin ─────────────────────────────────────────────────────────
export const togglePinPost = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const post = await LeadershipPost.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: "Not found." });

    post.isPinned = !post.isPinned;
    post.pinnedAt = post.isPinned ? new Date() : null;
    await post.save();

    res.status(200).json({ success: true, isPinned: post.isPinned });
  } catch (err) {
    next(err);
  }
};

// ── Both: List posts ──────────────────────────────────────────────────────────
export const listPosts = async (req, res, next) => {
  try {
    const { postType, page = 1, limit = 20 } = req.query;
    const filter = { isDeleted: false };
    if (postType) filter.postType = postType;

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
    const lim = Math.min(50, parseInt(limit));

    const [posts, total] = await Promise.all([
      LeadershipPost.find(filter)
        .populate("createdBy", "name role")
        .select("-viewedBy -acknowledgements") // avoid large arrays in list
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(lim),
      LeadershipPost.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / lim), posts });
  } catch (err) {
    next(err);
  }
};

// ── Both: Get single post + track view ───────────────────────────────────────
export const getPost = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const post = await LeadershipPost.findOne({ _id: req.params.id, isDeleted: false })
      .populate("createdBy", "name role");
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });

    // Track view (addToSet prevents duplicates per user)
    const userId = req.user._id;
    await LeadershipPost.findByIdAndUpdate(req.params.id, {
      $addToSet: { viewedBy: { userId, viewedAt: new Date() } },
    });

    const hasAcknowledged = post.acknowledgements.some(
      (a) => a.userId?.toString() === userId.toString()
    );

    res.status(200).json({
      success: true,
      post: {
        ...post.toObject(),
        viewCount: post.viewedBy.length,
        ackCount: post.acknowledgements.length,
        hasAcknowledged,
        // Hide full arrays from members; admin gets them
        viewedBy: req.user.role === "admin" ? post.viewedBy : undefined,
        acknowledgements: req.user.role === "admin" ? post.acknowledgements : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Member: Acknowledge post ──────────────────────────────────────────────────
export const acknowledgePost = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const post = await LeadershipPost.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });

    const alreadyAcked = post.acknowledgements.some(
      (a) => a.userId?.toString() === req.user._id.toString()
    );
    if (alreadyAcked) return res.status(200).json({ success: true, message: "Already acknowledged." });

    await LeadershipPost.findByIdAndUpdate(req.params.id, {
      $push: { acknowledgements: { userId: req.user._id, acknowledgedAt: new Date() } },
    });

    // Notify admin
    const admin = await User.findById(post.createdBy);
    if (admin) {
      getIO().to(admin._id.toString()).emit("leadership_post_acknowledged", {
        postId: post._id,
        title: post.title,
        userId: req.user._id,
        userName: req.user.name,
      });
    }

    res.status(200).json({ success: true, message: "Acknowledged." });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Acknowledgement stats ──────────────────────────────────────────────
export const getPostStats = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const post = await LeadershipPost.findById(req.params.id)
      .populate("acknowledgements.userId", "name email")
      .populate("viewedBy.userId", "name email")
      .select("title acknowledgements viewedBy");

    if (!post) return res.status(404).json({ success: false, message: "Not found." });

    const totalMembers = await User.countDocuments({ role: "member" });
    res.status(200).json({
      success: true,
      title: post.title,
      totalMembers,
      viewCount: post.viewedBy.length,
      ackCount: post.acknowledgements.length,
      acknowledgements: post.acknowledgements,
    });
  } catch (err) {
    next(err);
  }
};
