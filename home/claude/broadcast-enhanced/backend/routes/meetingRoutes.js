import express from "express";
import {
  createMeeting, getAdminMeetings, getMemberMeetings,
  updateMeeting, cancelMeeting, joinMeeting, sendReminders,
} from "../controllers/meetingController.js";
import { protect, adminOnly, memberOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Admin
router.post("/", adminOnly, createMeeting);
router.get("/admin", adminOnly, getAdminMeetings);
router.patch("/:id", adminOnly, updateMeeting);
router.delete("/:id", adminOnly, cancelMeeting);
router.post("/reminders/send", adminOnly, sendReminders);

// Member
router.get("/mine", memberOnly, getMemberMeetings);
router.post("/:id/join", protect, joinMeeting);

export default router;
