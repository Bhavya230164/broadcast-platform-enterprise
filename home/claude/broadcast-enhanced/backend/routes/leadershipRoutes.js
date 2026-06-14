import express from "express";
import {
  createPost, updatePost, deletePost, togglePinPost,
  listPosts, getPost, acknowledgePost, getPostStats,
} from "../controllers/leadershipController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { leadershipImageUpload } from "../middlewares/upload.js";

const router = express.Router();
router.use(protect);

// Admin
router.post("/", adminOnly, leadershipImageUpload, createPost);
router.patch("/:id", adminOnly, leadershipImageUpload, updatePost);
router.delete("/:id", adminOnly, deletePost);
router.patch("/:id/pin", adminOnly, togglePinPost);
router.get("/:id/stats", adminOnly, getPostStats);

// Both
router.get("/", listPosts);
router.get("/:id", getPost);
router.patch("/:id/acknowledge", acknowledgePost);

export default router;
