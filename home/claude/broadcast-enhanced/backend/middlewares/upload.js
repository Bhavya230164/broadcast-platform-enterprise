/**
 * Upload middleware wrappers — Extended for enterprise features
 */
import {
  uploadAvatar, uploadAttachment, uploadKBDocument, uploadLeadershipImage,
} from "../config/multer.js";

const handleMulterError = (err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ success: false, message: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 10}MB.` });
  if (err?.code === "LIMIT_FILE_COUNT")
    return res.status(413).json({ success: false, message: "Too many files. Max 5 per message." });
  if (err)
    return res.status(400).json({ success: false, message: err.message });
  next();
};

export const avatarUpload = (req, res, next) =>
  uploadAvatar.single("avatar")(req, res, (err) => handleMulterError(err, req, res, next));

export const attachmentUpload = (req, res, next) =>
  uploadAttachment.array("attachments", 5)(req, res, (err) => handleMulterError(err, req, res, next));

export const kbUpload = (req, res, next) =>
  uploadKBDocument.single("file")(req, res, (err) => handleMulterError(err, req, res, next));

export const leadershipImageUpload = (req, res, next) =>
  uploadLeadershipImage.single("featuredImage")(req, res, (err) => handleMulterError(err, req, res, next));
