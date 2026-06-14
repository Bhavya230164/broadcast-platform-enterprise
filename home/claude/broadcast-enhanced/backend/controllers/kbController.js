/**
 * Knowledge Base Controller
 * Admin: upload, edit, delete documents
 * Member: list, search, download (read-only)
 */
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import KBDocument, { KB_CATEGORIES_LIST } from "../models/KBDocument.js";
import { getFileType } from "../config/multer.js";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.enum(KB_CATEGORIES_LIST),
  tags: z.string().optional().default(""), // comma-separated string from form-data
});

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  category: z.enum(KB_CATEGORIES_LIST).optional(),
  tags: z.string().optional(),
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

// ── Admin: Upload document ────────────────────────────────────────────────────
export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

    const data = validate(createSchema, req.body);
    const tags = data.tags
      ? data.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const doc = await KBDocument.create({
      title: data.title,
      description: data.description,
      category: data.category,
      tags,
      uploadedBy: req.user._id,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        url: `/uploads/kb/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fileType: getFileType(req.file.mimetype),
      },
    });

    const populated = await KBDocument.findById(doc._id).populate("uploadedBy", "name");
    res.status(201).json({ success: true, message: "Document uploaded.", document: populated });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Update document metadata ──────────────────────────────────────────
export const updateDocument = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const data = validate(updateSchema, req.body);
    const updateFields = { ...data };
    if (data.tags !== undefined) {
      updateFields.tags = data.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      delete updateFields.tags_string;
    }

    const doc = await KBDocument.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate("uploadedBy", "name");

    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });
    res.status(200).json({ success: true, message: "Document updated.", document: doc });
  } catch (err) {
    next(err);
  }
};

// ── Admin: Delete document (soft + remove file) ───────────────────────────────
export const deleteDocument = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const doc = await KBDocument.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

    // Remove physical file
    const filePath = path.join("uploads/kb", doc.file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.status(200).json({ success: true, message: "Document deleted." });
  } catch (err) {
    next(err);
  }
};

// ── Both: List / Search documents ─────────────────────────────────────────────
export const listDocuments = async (req, res, next) => {
  try {
    const { category, q, page = 1, limit = 20 } = req.query;
    const filter = { isDeleted: false };

    if (category && KB_CATEGORIES_LIST.includes(category)) filter.category = category;
    if (q) filter.$text = { $search: q };

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
    const lim = Math.min(50, parseInt(limit));

    const [documents, total] = await Promise.all([
      KBDocument.find(filter)
        .populate("uploadedBy", "name")
        .sort(q ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip(skip)
        .limit(lim),
      KBDocument.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / lim),
      categories: KB_CATEGORIES_LIST,
      documents,
    });
  } catch (err) {
    next(err);
  }
};

// ── Both: Get single document ─────────────────────────────────────────────────
export const getDocument = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    const doc = await KBDocument.findOne({ _id: req.params.id, isDeleted: false }).populate("uploadedBy", "name");
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

    res.status(200).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
};

// ── Both: Increment download count ───────────────────────────────────────────
export const trackDownload = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: "Invalid ID." });

    await KBDocument.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } });
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};
