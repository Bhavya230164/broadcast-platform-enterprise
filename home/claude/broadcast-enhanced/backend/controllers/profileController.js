/**
 * Profile Controller
 * Features: view profile, update name/preferences, upload/change/remove avatar, dark mode
 */
import path from "path";
import fs from "fs";
import User from "../models/User.js";
import { validate, updateProfileSchema } from "../config/validation.js";

// ── Get Profile ────────────────────────────────────────────────────────────────
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+twoFA.enabled");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.status(200).json({ success: true, user });
  } catch (err) { next(err); }
};

// ── Update Profile (name, preferences) ────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const data = validate(updateProfileSchema, req.body);
    const updateFields = {};
    if (data.name) updateFields.name = data.name;
    if (data.preferences) {
      if (data.preferences.darkMode !== undefined) updateFields["preferences.darkMode"] = data.preferences.darkMode;
      if (data.preferences.emailNotifications !== undefined) updateFields["preferences.emailNotifications"] = data.preferences.emailNotifications;
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updateFields }, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: "Profile updated.", user });
  } catch (err) { next(err); }
};

// ── Upload / Change Avatar ─────────────────────────────────────────────────────
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

    // Remove old avatar file from disk if it exists
    const existingUser = await User.findById(req.user._id);
    if (existingUser?.avatar?.publicId) {
      const oldPath = path.join("uploads/avatars", existingUser.avatar.publicId);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const avatarData = {
      url: `/uploads/avatars/${req.file.filename}`,
      publicId: req.file.filename,
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarData },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile photo updated.",
      avatar: user.avatar,
      user,
    });
  } catch (err) { next(err); }
};

// ── Remove Avatar ──────────────────────────────────────────────────────────────
export const removeAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // Delete file from disk
    if (user.avatar?.publicId) {
      const filePath = path.join("uploads/avatars", user.avatar.publicId);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await User.findByIdAndUpdate(req.user._id, { avatar: { url: null, publicId: null } });
    res.status(200).json({ success: true, message: "Profile photo removed." });
  } catch (err) { next(err); }
};

// ── Toggle Dark Mode ───────────────────────────────────────────────────────────
export const toggleDarkMode = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const newVal = !user.preferences.darkMode;
    await User.findByIdAndUpdate(req.user._id, { "preferences.darkMode": newVal });
    res.status(200).json({ success: true, darkMode: newVal, message: `Dark mode ${newVal ? "enabled" : "disabled"}.` });
  } catch (err) { next(err); }
};
