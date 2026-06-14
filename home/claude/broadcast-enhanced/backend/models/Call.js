import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
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
      enum: ["missed", "completed", "rejected", "ongoing", "cancelled"],
      default: "ongoing",
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
  },
  { timestamps: true }
);

callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });

const Call = mongoose.model("Call", callSchema);
export default Call;
