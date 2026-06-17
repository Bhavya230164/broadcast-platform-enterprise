/**
 * Auth Controller — Enhanced
 * Features: register, login, OTP login, 2FA, password reset, getMe
 */
import jwt from "jsonwebtoken";
import crypto from "crypto";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import User from "../models/User.js";
import { 
  sendEmail, 
  resetEmailHtml, 
  createTransporter 
} from "../config/mailer.js";
import {
  registerSchema, loginSchema,
  forgotPasswordSchema, resetPasswordSchema, verify2FASchema,
  changePasswordSchema, validate,
} from "../config/validation.js";


// ── Helpers ────────────────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit

// ── Register ───────────────────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const data = validate(registerSchema, req.body);

    // Force role to "member" — admin accounts cannot be created via registration
    data.role = "member";

    const exists = await User.findOne({ email: data.email });
    if (exists) return res.status(409).json({ success: false, message: "Email already registered." });

    // Set default preferences for new users
    data.preferences = {
      darkMode: false,
      appNotifications: true, // Enable by default at account level
      emailNotifications: true,
    };

    const user = await User.create(data);
    const token = signToken(user);
    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, preferences: user.preferences },
    });
  } catch (err) { next(err); }
};

// ── Login ──────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    console.log("========== LOGIN REQUEST ==========");
    console.log("BODY:", req.body);

    const data = validate(loginSchema, req.body);

    const user = await User.findOne({ email: data.email })
      .select("+password +twoFA.enabled +twoFA.secret");

    console.log("USER FOUND:", !!user);

    if (!user || !(await user.comparePassword(data.password))) {
      console.log("INVALID EMAIL OR PASSWORD");

      return res.status(401).json({
        success: false,
        message: "Invalid email or password. Please try again.",
      });
    }

    console.log("LOGIN SUCCESS:", user.email);

    if (user.twoFA?.enabled) {
      const tempToken = jwt.sign(
        { id: user._id, require2FA: true },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );

      return res.status(200).json({
        success: true,
        require2FA: true,
        tempToken,
        message: "2FA verification required.",
      });
    }

    const token = signToken(user);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        preferences: user.preferences,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    next(err);
  }
};
// ── Verify 2FA TOTP ────────────────────────────────────────────────────────────
export const verify2FA = async (req, res, next) => {
  try {
    const { token: totpToken } = validate(verify2FASchema, req.body);
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Temp token required." });

    let decoded;
    try { decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: "Invalid or expired temp token." }); }

    if (!decoded.require2FA) return res.status(400).json({ success: false, message: "2FA not required for this session." });

    const user = await User.findById(decoded.id).select("+twoFA.secret +twoFA.enabled");
    if (!user || !user.twoFA?.secret) return res.status(404).json({ success: false, message: "User not found." });

    const valid = speakeasy.totp.verify({
      secret: user.twoFA.secret,
      encoding: "base32",
      token: totpToken,
      window: 2,
    });
    if (!valid) return res.status(401).json({ success: false, message: "Invalid 2FA code." });

    const finalToken = signToken(user);
    res.status(200).json({
      success: true,
      message: "2FA verified. Login complete.",
      token: finalToken,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, preferences: user.preferences },
    });
  } catch (err) { next(err); }
};

// ── Setup 2FA ──────────────────────────────────────────────────────────────────
export const setup2FA = async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({ name: `BroadcastPlatform (${req.user.email})`, length: 20 });
    const qrUrl = await qrcode.toDataURL(secret.otpauth_url);

    await User.findByIdAndUpdate(req.user._id, {
      "twoFA.secret": secret.base32,
      "twoFA.qrCodeUrl": qrUrl,
    });

    res.status(200).json({
      success: true,
      message: "Scan the QR code with your authenticator app, then confirm with a code.",
      qrCode: qrUrl,
      manualKey: secret.base32,
    });
  } catch (err) { next(err); }
};

// ── Enable 2FA (confirm with first TOTP) ──────────────────────────────────────
export const enable2FA = async (req, res, next) => {
  try {
    const { token: totpToken } = validate(verify2FASchema, req.body);
    const user = await User.findById(req.user._id).select("+twoFA.secret");
    if (!user?.twoFA?.secret) return res.status(400).json({ success: false, message: "Please call /auth/2fa/setup first." });

    const valid = speakeasy.totp.verify({ secret: user.twoFA.secret, encoding: "base32", token: totpToken, window: 2 });
    if (!valid) return res.status(400).json({ success: false, message: "Invalid code. Please try again." });

    await User.findByIdAndUpdate(req.user._id, { "twoFA.enabled": true });
    res.status(200).json({ success: true, message: "Two-factor authentication enabled." });
  } catch (err) { next(err); }
};

// ── Disable 2FA ────────────────────────────────────────────────────────────────
export const disable2FA = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { "twoFA.enabled": false, "twoFA.secret": null });
    res.status(200).json({ success: true, message: "Two-factor authentication disabled." });
  } catch (err) { next(err); }
};


// ── Forgot Password ────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = validate(forgotPasswordSchema, req.body);
    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) return res.status(200).json({ success: true, message: "Password reset link has been sent to your email." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.findByIdAndUpdate(user._id, {
      "passwordReset.token": resetToken,
      "passwordReset.expiresAt": expiresAt,
    });

    // Log the reset token and URL for debugging
    console.log(`[Auth] Password reset token generated for ${email}: ${resetToken}`);
    const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password?token=${resetToken}`;
    console.log(`[Auth] Password reset URL: ${resetUrl}`);

    try {
      // Direct call ensures any reference or type errors are caught by the catch block or global handler
      await sendEmail({
        to: email,
        subject: "Password Reset Request",
        html: resetEmailHtml(user.name, resetUrl)
      });
      console.log(`[Auth] Password reset email sent successfully to ${email}`);
    } catch (mailError) {
      console.error(`[Auth] Failed to send email via sendEmail function:`, mailError);
      if (process.env.NODE_ENV !== 'production') {
        return next(mailError); 
      }
    }

    res.status(200).json({ success: true, message: "Password reset link has been sent to your email." });
  } catch (err) { next(err); }
};

// ── Reset Password ─────────────────────────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = validate(resetPasswordSchema, req.body);
    const user = await User.findOne({ "passwordReset.token": token }).select("+passwordReset.token +passwordReset.expiresAt");

    if (!user || new Date() > new Date(user.passwordReset?.expiresAt)) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired." });
    }

    user.password = newPassword;
    user.passwordReset = { token: null, expiresAt: null };
    await user.save();

    res.status(200).json({ success: true, message: "Password reset successfully. Please log in." });
  } catch (err) { next(err); }
};

// ── Change Password (authenticated) ───────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = validate(changePasswordSchema, req.body);
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch (err) { next(err); }
};

// ── Get Me ─────────────────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+twoFA.enabled");
    res.status(200).json({ success: true, user });
  } catch (err) { next(err); }
};
