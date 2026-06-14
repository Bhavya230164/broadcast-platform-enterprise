import express from "express";
import {
  createPoll, getAdminPolls, closePoll, deletePoll,
  getPollStats, getAllPolls, votePoll,
} from "../controllers/pollController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Admin
router.post("/", adminOnly, createPoll);
router.get("/admin", adminOnly, getAdminPolls);
router.patch("/:id/close", adminOnly, closePoll);
router.delete("/:id", adminOnly, deletePoll);
router.get("/:id/stats", adminOnly, getPollStats);

// Both roles
router.get("/", getAllPolls);
router.post("/:id/vote", votePoll);

export default router;
