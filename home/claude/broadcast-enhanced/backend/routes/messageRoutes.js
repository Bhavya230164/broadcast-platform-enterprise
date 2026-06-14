import express from "express";
import {
  sendMessage, getInbox, getGroupMessages, markAsRead,
  acknowledgeMessage, togglePinMessage, getPinnedMessages,
} from "../controllers/messageController.js";
import { protect, adminOnly, memberOnly } from "../middlewares/authMiddleware.js";
import { attachmentUpload } from "../middlewares/upload.js";

const router = express.Router();
router.use(protect);

// Admin
router.post("/send", adminOnly, attachmentUpload, sendMessage);
router.get("/group/:groupId", adminOnly, getGroupMessages);
router.patch("/:id/pin", adminOnly, togglePinMessage);

// Member
router.get("/inbox", memberOnly, getInbox);
router.get("/pinned", memberOnly, getPinnedMessages);
router.patch("/:id/read", memberOnly, markAsRead);
router.patch("/:id/acknowledge", memberOnly, acknowledgeMessage);

export default router;
