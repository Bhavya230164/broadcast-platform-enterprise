import express from "express";
import {
  register, login, getMe, verify2FA, setup2FA, enable2FA, disable2FA,
   forgotPassword, resetPassword, changePassword,
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public
router.post("/register", register);
router.post("/login", login);
router.post("/verify-2fa", verify2FA);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected
router.get("/me", protect, getMe);
router.post("/change-password", protect, changePassword);
router.get("/2fa/setup", protect, setup2FA);
router.post("/2fa/enable", protect, enable2FA);
router.post("/2fa/disable", protect, disable2FA);

export default router;
