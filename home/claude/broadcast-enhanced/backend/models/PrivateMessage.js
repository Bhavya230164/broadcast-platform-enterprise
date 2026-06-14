import mongoose from "mongoose";

const privateMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Message must have a sender."],
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Message must have a receiver."],
    },
    content: {
      type: String,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters."],
      default: "",
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    attachments: [
      {
        originalName: String,
        filename: String,
        url: String,
        mimetype: String,
        size: Number,
        fileType: {
          type: String,
          enum: ["image", "pdf", "document", "other"],
          default: "other",
        },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes to fetch chat history between two users efficiently
privateMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
privateMessageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

const PrivateMessage = mongoose.model("PrivateMessage", privateMessageSchema);
export default PrivateMessage;
