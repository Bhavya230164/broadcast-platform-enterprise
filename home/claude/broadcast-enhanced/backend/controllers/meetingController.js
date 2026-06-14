/**
 * Meeting Controller
 * Features: create, update, cancel, join, reminders, member view
 */
import Meeting from "../models/Meeting.js";
import Group from "../models/Group.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { createMeetingSchema, updateMeetingSchema, validate } from "../config/validation.js";
import { emitToUsers } from "../config/socket.js";
import { sendEmail, meetingReminderHtml } from "../config/mailer.js";
import mongoose from "mongoose";

// ── Detect platform from URL ───────────────────────────────────────────────────
const detectPlatform = (url) => {
  if (!url) return "other";
  if (url.includes("meet.google.com")) return "google_meet";
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("teams.microsoft.com")) return "teams";
  return "other";
};

// ── Create Meeting (admin) ─────────────────────────────────────────────────────
export const createMeeting = async (req, res, next) => {
  try {
    const data = validate(createMeetingSchema, req.body);

    const group = await Group.findOne({ _id: data.groupId, adminId: req.user._id });
    if (!group) return res.status(404).json({ success: false, message: "Group not found or access denied." });

    // Invitees: use provided list or fall back to all group members
    let invitees = data.inviteeIds.length > 0 ? data.inviteeIds : group.members.map((m) => m.toString());

    const meeting = await Meeting.create({
      title: data.title,
      description: data.description,
      scheduledAt: new Date(data.scheduledAt),
      durationMinutes: data.durationMinutes,
      createdBy: req.user._id,
      groupId: data.groupId,
      invitees,
      meetingLink: data.meetingLink,
      platform: data.meetingLink ? detectPlatform(data.meetingLink) : data.platform,
      reminders: data.reminders,
    });

    // Notify all invitees
    const notifDocs = invitees.map((uid) => ({
      userId: uid,
      type: "meeting_scheduled",
      title: "Meeting Scheduled",
      body: `"${meeting.title}" — ${new Date(meeting.scheduledAt).toLocaleString()}`,
      refId: meeting._id,
      refModel: "Meeting",
      metadata: { meetingLink: meeting.meetingLink, platform: meeting.platform },
    }));
    await Notification.insertMany(notifDocs);
    emitToUsers(invitees, "meeting_scheduled", {
      meetingId: meeting._id,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      meetingLink: meeting.meetingLink,
      platform: meeting.platform,
    });

    res.status(201).json({ success: true, message: "Meeting created.", meeting });
  } catch (err) { next(err); }
};

// ── Get Admin Meetings ─────────────────────────────────────────────────────────
export const getAdminMeetings = async (req, res, next) => {
  try {
    const meetings = await Meeting.find({ createdBy: req.user._id })
      .populate("groupId", "name")
      .populate("invitees", "name email")
      .sort({ scheduledAt: 1 });
    res.status(200).json({ success: true, count: meetings.length, meetings });
  } catch (err) { next(err); }
};

// ── Get Member Meetings ────────────────────────────────────────────────────────
export const getMemberMeetings = async (req, res, next) => {
  try {
    const meetings = await Meeting.find({
      invitees: req.user._id,
      status: { $ne: "cancelled" },
    })
      .select("title description scheduledAt durationMinutes meetingLink platform status joinedBy groupId createdAt")
      .populate("groupId", "name")
      .sort({ scheduledAt: 1 });

    const shaped = meetings.map((m) => ({
      _id: m._id,
      title: m.title,
      description: m.description,
      scheduledAt: m.scheduledAt,
      durationMinutes: m.durationMinutes,
      meetingLink: m.meetingLink,
      platform: m.platform,
      status: m.status,
      hasJoined: m.joinedBy.some((id) => id.toString() === req.user._id.toString()),
      groupName: m.groupId?.name,
      createdAt: m.createdAt,
    }));

    res.status(200).json({ success: true, count: shaped.length, meetings: shaped });
  } catch (err) { next(err); }
};

// ── Update Meeting (admin) ─────────────────────────────────────────────────────
export const updateMeeting = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const data = validate(updateMeetingSchema, req.body);
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found." });
    res.status(200).json({ success: true, message: "Meeting updated.", meeting });
  } catch (err) { next(err); }
};

// ── Cancel Meeting (admin) ─────────────────────────────────────────────────────
export const cancelMeeting = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { status: "cancelled" },
      { new: true }
    );
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found." });

    // Notify invitees of cancellation
    const notifDocs = meeting.invitees.map((uid) => ({
      userId: uid,
      type: "meeting_cancelled",
      title: "Meeting Cancelled",
      body: `"${meeting.title}" has been cancelled.`,
      refId: meeting._id,
      refModel: "Meeting",
    }));
    await Notification.insertMany(notifDocs);
    emitToUsers(meeting.invitees.map((id) => id.toString()), "meeting_cancelled", { meetingId: meeting._id, title: meeting.title });

    res.status(200).json({ success: true, message: "Meeting cancelled." });
  } catch (err) { next(err); }
};

// ── Join Meeting (member clicks "Join") ───────────────────────────────────────
export const joinMeeting = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, invitees: req.user._id },
      { $addToSet: { joinedBy: req.user._id } },
      { new: true }
    );
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found or not invited." });

    res.status(200).json({
      success: true,
      message: "Joining meeting.",
      meetingLink: meeting.meetingLink,
      platform: meeting.platform,
    });
  } catch (err) { next(err); }
};

// ── Send Meeting Reminders (called by a cron job or scheduled task) ────────────
// This would be called periodically; for simplicity exposed as an admin endpoint
export const sendReminders = async (req, res, next) => {
  try {
    const now = new Date();
    const meetings = await Meeting.find({
      status: "scheduled",
      "reminders.sentAt": null,
    }).populate("invitees", "name email preferences");

    let sentCount = 0;
    for (const meeting of meetings) {
      for (const reminder of meeting.reminders) {
        if (reminder.sentAt) continue;
        const triggerTime = new Date(meeting.scheduledAt.getTime() - reminder.minutesBefore * 60 * 1000);
        if (now >= triggerTime) {
          // Send email + socket notification to all invitees
          for (const invitee of meeting.invitees) {
            if (invitee.preferences?.emailNotifications) {
              await sendEmail({
                to: invitee.email,
                subject: `Reminder: ${meeting.title} in ${reminder.minutesBefore} minutes`,
                html: meetingReminderHtml(invitee.name, meeting),
              }).catch(console.error);
            }
          }
          emitToUsers(
            meeting.invitees.map((u) => u._id.toString()),
            "meeting_reminder",
            { meetingId: meeting._id, title: meeting.title, minutesBefore: reminder.minutesBefore, scheduledAt: meeting.scheduledAt, meetingLink: meeting.meetingLink }
          );
          reminder.sentAt = now;
          sentCount++;
        }
      }
      await meeting.save();
    }

    res.status(200).json({ success: true, message: `Processed ${sentCount} reminder(s).` });
  } catch (err) { next(err); }
};
