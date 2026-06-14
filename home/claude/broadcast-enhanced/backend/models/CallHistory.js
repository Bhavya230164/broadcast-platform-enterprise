import mongoose from "mongoose";

const callHistorySchema = new mongoose.Schema(
{
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  type: {
    type: String,
    enum: ["voice", "video"],
    required: true,
  },

  status: {
    type: String,
    enum: ["missed", "answered", "rejected", "completed"],
    default: "missed",
  },

  duration: {
    type: Number,
    default: 0,
  },

  answeredAt: {
    type: Date,
    default: null,
  },

  endedAt: {
    type: Date,
    default: null,
  },
},
{
  timestamps: true,
}
);

callHistorySchema.index({ caller: 1, createdAt: -1 });
callHistorySchema.index({ receiver: 1, createdAt: -1 });
callHistorySchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("CallHistory", callHistorySchema);
