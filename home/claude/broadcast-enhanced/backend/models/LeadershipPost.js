/**
 * LeadershipPost Model — CEO / Leadership Corner
 * Features: CEO messages, vision/goals, member acknowledgement, no replies
 */
import mongoose from "mongoose";

const leadershipPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters."],
    },
    content: {
      type: String,
      required: [true, "Content is required."],
      trim: true,
      maxlength: [10000, "Content cannot exceed 10000 characters."],
    },
    // Category of leadership post
    postType: {
      type: String,
      enum: ["ceo_message", "company_vision", "goals", "leadership_update", "general"],
      default: "general",
    },
    // Author display override (e.g. "John Smith, CEO")
    authorLabel: {
      type: String,
      trim: true,
      maxlength: [100, "Author label cannot exceed 100 characters."],
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    // Optional featured image
    featuredImage: {
      url: { type: String, default: null },
      filename: { type: String, default: null },
    },
    // Per-member acknowledgements
    acknowledgements: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        acknowledgedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    // Views tracking
    viewedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

leadershipPostSchema.index({ isPinned: -1, createdAt: -1 });
leadershipPostSchema.index({ postType: 1, createdAt: -1 });
leadershipPostSchema.index({ "acknowledgements.userId": 1 });

const LeadershipPost = mongoose.model("LeadershipPost", leadershipPostSchema);
export default LeadershipPost;
