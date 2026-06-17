/**
 * User Model — Enhanced
 * Adds: profile photo, online status, 2FA, OTP, password reset, dark mode pref
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [2, "Name must be at least 2 characters."],
      maxlength: [60, "Name cannot exceed 60 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address."],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters."],
      select: false,
    },
    role: {
      type: String,
      enum: { values: ["admin", "member"], message: "Role must be admin or member." },
      default: "member",
    },

    // ── Profile Photo ─────────────────────────────────────────────────────────
    avatar: {
      url: { type: String, default: null },       // relative path: /uploads/avatars/xxx.jpg
      publicId: { type: String, default: null },  // filename without path
    },

    // ── Online / Offline Status ────────────────────────────────────────────────
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },

    // ── Two-Factor Authentication (TOTP via Authenticator app) ─────────────────
    twoFA: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },    // base32 TOTP secret
      qrCodeUrl: { type: String, select: false }, // ephemeral, for setup only
    },



    // ── Password Reset ─────────────────────────────────────────────────────────
    passwordReset: {
      token: { type: String, select: false },
      expiresAt: { type: Date, select: false },
    },

    // ── UI Preferences ─────────────────────────────────────────────────────────
    preferences: {
      darkMode: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: true },
      appNotifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ isOnline: 1 });

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance: compare password ────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Instance: strip sensitive fields from JSON output ─────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFA?.secret;
  delete obj.passwordReset;
  return obj;
};

const User = mongoose.model("User", userSchema);
export default User;
