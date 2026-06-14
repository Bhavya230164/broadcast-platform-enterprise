import express from "express";
import {
  createGroup,
  getAdminGroups,
  getMemberGroups,
  getGroupById,
  updateGroup,
  addMembers,
  removeMember,
  deleteGroup,
  getAllMembers,
} from "../controllers/groupController.js";
import { protect, adminOnly, memberOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All group routes require authentication
router.use(protect);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.get("/users", adminOnly, getAllMembers);          // All members (for UI picker)
router.post("/", adminOnly, createGroup);                // Create group
router.get("/", adminOnly, getAdminGroups);              // List admin's groups
router.get("/:id", adminOnly, getGroupById);             // Single group details
router.patch("/:id", adminOnly, updateGroup);            // Edit group name/desc
router.delete("/:id", adminOnly, deleteGroup);           // Delete group + messages
router.post("/:id/members", adminOnly, addMembers);      // Add members to group
router.delete("/:id/members/:memberId", adminOnly, removeMember); // Remove member

// ── Member-only routes ────────────────────────────────────────────────────────
router.get("/mine", memberOnly, getMemberGroups);        // Member's own groups

export default router;
