/**
 * Zod Validation Schemas — Enhanced
 * Includes all original schemas + new ones for meetings, 2FA, OTP, password reset
 */
import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required."),
});


export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  newPassword: z.string().min(6, "Password must be at least 6 characters."),
});

export const verify2FASchema = z.object({
  token: z.string().length(6).regex(/^\d+$/, "2FA token must be 6 digits."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// ── Groups ────────────────────────────────────────────────────────────────────
export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional().default(""),
  memberIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional().default([]),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(200).optional(),
});

export const addMembersSchema = z.object({
  memberIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
});

// ── Messages ──────────────────────────────────────────────────────────────────
export const sendMessageSchema = z.object({
  groupId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid group ID."),
  content: z.string().trim().max(2000).optional().default(""),
  type: z.enum(["broadcast", "selective"]).default("broadcast"),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  receiverIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional().default([]),
});

// ── Meetings ──────────────────────────────────────────────────────────────────
export const createMeetingSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional().default(""),
  scheduledAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date/time."),
  durationMinutes: z.number().int().min(5).max(480).optional().default(60),
  groupId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid group ID."),
  inviteeIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional().default([]),
  meetingLink: z.string().url("Must be a valid URL.").optional().or(z.literal("")).default(""),
  platform: z.enum(["google_meet", "zoom", "teams", "other"]).optional().default("other"),
  reminders: z
    .array(z.object({ minutesBefore: z.number().int().min(1).max(1440) }))
    .optional()
    .default([{ minutesBefore: 30 }, { minutesBefore: 5 }]),
});

export const updateMeetingSchema = createMeetingSchema.partial().omit({ groupId: true });

// ── Profile ───────────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  preferences: z
    .object({
      darkMode: z.boolean().optional(),
      emailNotifications: z.boolean().optional(),
      appNotifications: z.boolean().optional(),
    })
    .optional(),
});

// ── Validation helper ─────────────────────────────────────────────────────────
export const validate = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const messages = result.error.issues.map(
      (e) => e.message
    );

    const err = new Error(messages.join(" | "));
    err.statusCode = 400;
    throw err;
  }

  return result.data;
};