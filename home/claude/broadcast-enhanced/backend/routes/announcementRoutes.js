import express from "express";
import {
  createAnnouncement, updateAnnouncement, deleteAnnouncement, togglePin,
  getAdminAnnouncements, getMemberAnnouncements, markAnnouncementRead,
  getAnnouncementStats,
} from "../controllers/announcementController.js";
import { protect, adminOnly, memberOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Admin
router.post("/", adminOnly, createAnnouncement);
router.get("/admin", adminOnly, getAdminAnnouncements);
router.patch("/:id", adminOnly, updateAnnouncement);
router.delete("/:id", adminOnly, deleteAnnouncement);
router.patch("/:id/pin", adminOnly, togglePin);
router.get("/:id/stats", adminOnly, getAnnouncementStats);

// Member
router.get("/", getMemberAnnouncements);          // accessible by both (member sees filtered)
router.patch("/:id/read", markAnnouncementRead);  // both roles can mark read

export default router;
