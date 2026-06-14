import express from "express";
import { getProfile, updateProfile, uploadAvatar, removeAvatar, toggleDarkMode } from "../controllers/profileController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { avatarUpload } from "../middlewares/upload.js";

const router = express.Router();
router.use(protect);

router.get("/", getProfile);
router.patch("/", updateProfile);
router.post("/avatar", avatarUpload, uploadAvatar);
router.delete("/avatar", removeAvatar);
router.patch("/dark-mode", toggleDarkMode);

export default router;
