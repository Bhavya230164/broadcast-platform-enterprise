/**
 * Poll Model — Polls Feature
 * Features: multiple options, single vote per user, active/closed status, soft delete
 */
import mongoose from "mongoose";

const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Question is required."],
      trim: true,
      maxlength: [300, "Question cannot exceed 300 characters."],
    },

    options: [
      {
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: [200, "Option text cannot exceed 200 characters."],
        },
        votes: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            votedAt: { type: Date, default: Date.now },
            _id: false,
          },
        ],
      },
    ],

    // Who created it — must be admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },

    closedAt: { type: Date, default: null },

    isDeleted: { type: Boolean, default: false }, // soft delete
  },
  { timestamps: true }
);

pollSchema.index({ status: 1, createdAt: -1 });
pollSchema.index({ isDeleted: 1 });
pollSchema.index({ "options.votes.userId": 1 });

const Poll = mongoose.model("Poll", pollSchema);
export default Poll;
