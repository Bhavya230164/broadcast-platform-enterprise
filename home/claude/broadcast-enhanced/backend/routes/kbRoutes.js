import express from "express";
import {
  uploadDocument, updateDocument, deleteDocument,
  listDocuments, getDocument, trackDownload,
} from "../controllers/kbController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { kbUpload } from "../middlewares/upload.js";

const router = express.Router();
router.use(protect);

// Admin-only write
router.post("/", adminOnly, kbUpload, uploadDocument);
router.patch("/:id", adminOnly, updateDocument);
router.delete("/:id", adminOnly, deleteDocument);

// Both admin + member read
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.post("/:id/download", trackDownload);

export default router;
