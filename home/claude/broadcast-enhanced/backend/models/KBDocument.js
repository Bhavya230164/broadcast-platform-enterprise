/**
 * KBDocument Model — Knowledge Base / Company Library
 * Features: categories, file upload, search, admin-only write, member read
 */
import mongoose from "mongoose";

const KB_CATEGORIES = [
  "HR Policies",
  "Training Materials",
  "Company Documents",
  "Technical Guides",
  "General",
];

const kbDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Document title is required."],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters."],
      default: "",
    },
    category: {
      type: String,
      enum: { values: KB_CATEGORIES, message: "Invalid category." },
      required: [true, "Category is required."],
    },
    // Uploaded file details
    file: {
      originalName: { type: String, required: true },
      filename: { type: String, required: true },   // stored on disk
      url: { type: String, required: true },         // /uploads/kb/xxx
      mimetype: { type: String, required: true },
      size: { type: Number, required: true },        // bytes
      fileType: {
        type: String,
        enum: ["image", "pdf", "document", "other"],
        default: "other",
      },
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Tags for search
    tags: [{ type: String, trim: true, lowercase: true }],
    // Download count
    downloadCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Text index for full-text search
kbDocumentSchema.index({ title: "text", description: "text", tags: "text" });
kbDocumentSchema.index({ category: 1, createdAt: -1 });
kbDocumentSchema.index({ isDeleted: 1 });

export const KB_CATEGORIES_LIST = KB_CATEGORIES;
const KBDocument = mongoose.model("KBDocument", kbDocumentSchema);
export default KBDocument;
