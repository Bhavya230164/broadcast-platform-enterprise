/**
 * Multer configuration — Extended for enterprise features
 * Handles: avatars, message attachments, KB documents, leadership images
 */
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// ── Avatar storage ─────────────────────────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { const d = "uploads/avatars"; ensureDir(d); cb(null, d); },
  filename: (_req, file, cb) => cb(null, `avatar-${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const avatarFilter = (_req, file, cb) => {
  ["image/jpeg","image/jpg","image/png","image/webp","image/gif"].includes(file.mimetype)
    ? cb(null, true) : cb(new Error("Only image files allowed for avatars."), false);
};
export const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5*1024*1024 }, fileFilter: avatarFilter });

// ── Message attachment storage ─────────────────────────────────────────────────
const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { const d = "uploads/files"; ensureDir(d); cb(null, d); },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 40);
    cb(null, `${uuidv4()}-${safe}${ext}`);
  },
});
const attachmentFilter = (_req, file, cb) => {
  const ok = ["image/jpeg","image/jpg","image/png","image/webp","image/gif",
    "application/pdf","application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain"];
  ok.includes(file.mimetype) ? cb(null, true) : cb(new Error("Unsupported file type."), false);
};
export const uploadAttachment = multer({ storage: attachmentStorage, limits: { fileSize: MAX_SIZE_BYTES, files: 5 }, fileFilter: attachmentFilter });

// ── Knowledge Base document storage ───────────────────────────────────────────
const kbStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { const d = "uploads/kb"; ensureDir(d); cb(null, d); },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 60);
    cb(null, `kb-${uuidv4()}-${safe}${ext}`);
  },
});
const kbFilter = (_req, file, cb) => {
  const ok = ["image/jpeg","image/jpg","image/png","image/webp",
    "application/pdf","application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain","application/zip","application/x-zip-compressed"];
  ok.includes(file.mimetype) ? cb(null, true) : cb(new Error("Unsupported KB document type."), false);
};
export const uploadKBDocument = multer({ storage: kbStorage, limits: { fileSize: MAX_SIZE_BYTES }, fileFilter: kbFilter });

// ── Leadership featured image storage ─────────────────────────────────────────
const leadershipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => { const d = "uploads/leadership"; ensureDir(d); cb(null, d); },
  filename: (_req, file, cb) => cb(null, `leadership-${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});
const leadershipFilter = (_req, file, cb) => {
  ["image/jpeg","image/jpg","image/png","image/webp"].includes(file.mimetype)
    ? cb(null, true) : cb(new Error("Only images allowed for leadership posts."), false);
};
export const uploadLeadershipImage = multer({ storage: leadershipStorage, limits: { fileSize: 5*1024*1024 }, fileFilter: leadershipFilter });

// ── File type helper ──────────────────────────────────────────────────────────
export const getFileType = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.includes("word") || mimetype.includes("excel") || mimetype.includes("sheet") || mimetype === "text/plain") return "document";
  return "other";
};
