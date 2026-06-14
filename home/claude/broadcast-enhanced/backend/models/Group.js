import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required."],
      trim: true,
      minlength: [2, "Group name must be at least 2 characters."],
      maxlength: [80, "Group name cannot exceed 80 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters."],
      default: "",
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Group must have an admin."],
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index to make group lookups by admin fast
groupSchema.index({ adminId: 1 });

// Index for member lookups (used when a member fetches their groups)
groupSchema.index({ members: 1 });

const Group = mongoose.model("Group", groupSchema);
export default Group;
