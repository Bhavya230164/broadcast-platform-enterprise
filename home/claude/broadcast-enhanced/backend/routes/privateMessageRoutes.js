import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { attachmentUpload } from "../middlewares/upload.js";
import {
  getChatUsers,
  getMessages,
  sendMessage,
  markAsRead,
} from "../controllers/privateMessageController.js";

const router = express.Router();

router.use(protect); // Ensure user is authenticated

router.get("/users", getChatUsers);
router.get("/:userId", getMessages);
router.post("/:userId", attachmentUpload, sendMessage);
router.put("/:userId/read", markAsRead);

export default router;
