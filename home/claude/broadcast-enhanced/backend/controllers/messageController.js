/**
 * Message Controller — Enhanced
 * Features: send with attachments, priority, broadcast/selective,
 *           read receipts, acknowledgements, pin messages, inbox pagination
 */
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import Notification from "../models/Notification.js";
import { sendMessageSchema, validate } from "../config/validation.js";
import { getIO, emitToUsers } from "../config/socket.js";
import { getFileType } from "../config/multer.js";
import mongoose from "mongoose";
import path from "path";

// ── Send Message ───────────────────────────────────────────────────────────────
export const sendMessage = async (req, res, next) => {
  try {
    // Parse body (may come as form-data if files are attached)
    const rawBody = {
      groupId: req.body.groupId,
      content: req.body.content || "",
      type: req.body.type || "broadcast",
      priority: req.body.priority || "normal",
      receiverIds: req.body.receiverIds
        ? (Array.isArray(req.body.receiverIds) ? req.body.receiverIds : JSON.parse(req.body.receiverIds))
        : [],
    };
    const data = validate(sendMessageSchema, rawBody);

    // Validate group ownership
    const group = await Group.findOne({ _id: data.groupId, adminId: req.user._id });
    if (!group) return res.status(404).json({ success: false, message: "Group not found or access denied." });

    // Determine receivers
    let receivers;
    if (data.type === "broadcast") {
      if (group.members.length === 0) return res.status(400).json({ success: false, message: "Group has no members." });
      receivers = group.members.map((m) => m.toString());
    } else {
      if (!data.receiverIds.length) return res.status(400).json({ success: false, message: "Select at least one receiver." });
      const groupSet = new Set(group.members.map((m) => m.toString()));
      const invalid = data.receiverIds.filter((id) => !groupSet.has(id));
      if (invalid.length) return res.status(400).json({ success: false, message: "Some receivers are not group members." });
      receivers = data.receiverIds;
    }

    // Build attachments array from uploaded files
    const attachments = (req.files || []).map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      url: `/uploads/files/${f.filename}`,
      mimetype: f.mimetype,
      size: f.size,
      fileType: getFileType(f.mimetype),
    }));

    // Validate: must have content OR at least one attachment
    if (!data.content.trim() && attachments.length === 0) {
      return res.status(400).json({ success: false, message: "Message must have content or at least one attachment." });
    }

    // Build receipt records (one per receiver, all unread initially)
    const receipts = receivers.map((uid) => ({ userId: uid, deliveredAt: null, readAt: null, acknowledgedAt: null }));

    const message = await Message.create({
      groupId: data.groupId,
      senderId: req.user._id,
      content: data.content,
      type: data.type,
      priority: data.priority,
      receivers,
      receipts,
      attachments,
    });

    const populated = await Message.findById(message._id)
      .populate("senderId", "name role")
      .populate("groupId", "name");

    // Build socket payload
    const socketPayload = {
      _id: populated._id,
      content: populated.content,
      type: populated.type,
      priority: populated.priority,
      groupName: populated.groupId?.name,
      groupId: data.groupId,
      senderName: populated.senderId?.name || "Admin",
      attachments: populated.attachments,
      createdAt: populated.createdAt,
    };

    // Emit new_message to each receiver's private room
    const io = getIO();
    receivers.forEach((uid) => {
      io.to(uid).emit("new_message", socketPayload);
      // Mark as delivered via socket
      io.to(uid).emit("message_delivered", { messageId: message._id });
    });

    // Create persistent notifications for each receiver
    const notifDocs = receivers.map((uid) => ({
      userId: uid,
      type: "new_message",
      title: data.priority === "urgent" ? "🚨 Urgent Message" : data.priority === "important" ? "⚠️ Important Message" : "New Message",
      body: data.content.substring(0, 120) || `${attachments.length} attachment(s)`,
      refId: message._id,
      refModel: "Message",
      metadata: { groupName: group.name, priority: data.priority },
    }));
    await Notification.insertMany(notifDocs);

    // Update delivered timestamps
    await Message.findByIdAndUpdate(message._id, {
      $set: { "receipts.$[].deliveredAt": new Date(), notifiedViaSocket: true },
    });

    res.status(201).json({
      success: true,
      message: `Message sent to ${receivers.length} recipient(s).`,
      sentMessage: socketPayload,
    });
  } catch (err) { next(err); }
};

// ── Get Inbox (member) ─────────────────────────────────────────────────────────
export const getInbox = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const priorityFilter = req.query.priority;
    const filter = { receivers: req.user._id };
    if (priorityFilter && ["normal", "important", "urgent"].includes(priorityFilter)) {
      filter.priority = priorityFilter;
    }

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .select("content type priority isPinned groupId attachments receipts createdAt")
        .populate("groupId", "name")
        .sort({ isPinned: -1, priority: -1, createdAt: -1 })
        .skip(skip).limit(limit),
      Message.countDocuments(filter),
    ]);

    // Auto-mark as read when fetched
    const now = new Date();
    await Message.updateMany(
      { _id: { $in: messages.map((m) => m._id) }, "receipts.userId": req.user._id, "receipts.readAt": null },
      { $set: { "receipts.$.readAt": now } }
    );

    const shaped = messages.map((m) => {
      const myReceipt = m.receipts?.find((r) => r.userId?.toString() === req.user._id.toString());
      return {
        _id: m._id,
        content: m.content,
        type: m.type,
        priority: m.priority,
        isPinned: m.isPinned,
        groupName: m.groupId?.name,
        groupId: m.groupId?._id,
        attachments: m.attachments,
        deliveredAt: myReceipt?.deliveredAt,
        readAt: myReceipt?.readAt || now,
        acknowledgedAt: myReceipt?.acknowledgedAt,
        createdAt: m.createdAt,
      };
    });

    // Emit read receipts back to admin via socket
    emitToUsers([], "receipts_updated", {}); // placeholder — per-message receipt below

    res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), messages: shaped });
  } catch (err) { next(err); }
};

// ── Acknowledge Message ("I Have Read") ───────────────────────────────────────
export const acknowledgeMessage = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid message ID." });
    }
    const now = new Date();
    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, receivers: req.user._id, "receipts.userId": req.user._id },
      { $set: { "receipts.$.acknowledgedAt": now, "receipts.$.readAt": now } },
      { new: true }
    ).populate("groupId", "adminId");

    if (!msg) return res.status(404).json({ success: false, message: "Message not found." });

    // Notify admin in real time
    const adminId = msg.groupId?.adminId?.toString();
    if (adminId) {
      getIO().to(adminId).emit("message_acknowledged", {
        messageId: msg._id,
        userId: req.user._id,
        userName: req.user.name,
        acknowledgedAt: now,
      });
    }

    res.status(200).json({ success: true, message: "Message acknowledged.", acknowledgedAt: now });
  } catch (err) { next(err); }
};

// ── Mark as Read ───────────────────────────────────────────────────────────────
export const markAsRead = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const now = new Date();
    await Message.findOneAndUpdate(
      { _id: req.params.id, receivers: req.user._id, "receipts.userId": req.user._id },
      { $set: { "receipts.$.readAt": now } }
    );
    res.status(200).json({ success: true, message: "Marked as read." });
  } catch (err) { next(err); }
};

// ── Pin / Unpin Message (admin) ────────────────────────────────────────────────
export const togglePinMessage = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID." });

    const msg = await Message.findById(req.params.id).populate("groupId", "adminId");
    if (!msg) return res.status(404).json({ success: false, message: "Message not found." });
    if (msg.groupId?.adminId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const newPinned = !msg.isPinned;
    await Message.findByIdAndUpdate(req.params.id, {
      isPinned: newPinned,
      pinnedAt: newPinned ? new Date() : null,
      pinnedBy: newPinned ? req.user._id : null,
    });

    // Notify receivers of pin event
    if (newPinned) {
      const notifDocs = msg.receivers.map((uid) => ({
        userId: uid,
        type: "message_pinned",
        title: "Message Pinned",
        body: msg.content.substring(0, 80) || "An attachment was pinned.",
        refId: msg._id,
        refModel: "Message",
      }));
      await Notification.insertMany(notifDocs);
      emitToUsers(msg.receivers.map((r) => r.toString()), "message_pinned", { messageId: msg._id });
    }

    res.status(200).json({ success: true, message: newPinned ? "Message pinned." : "Message unpinned.", isPinned: newPinned });
  } catch (err) { next(err); }
};

// ── Get Group Messages (admin) ─────────────────────────────────────────────────
export const getGroupMessages = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) return res.status(400).json({ success: false, message: "Invalid ID." });
    const group = await Group.findOne({ _id: req.params.groupId, adminId: req.user._id });
    if (!group) return res.status(404).json({ success: false, message: "Group not found." });

    const messages = await Message.find({ groupId: req.params.groupId })
      .select("content type priority isPinned attachments receipts receivers createdAt")
      .sort({ createdAt: -1 }).limit(100);

    const shaped = messages.map((m) => ({
      _id: m._id,
      content: m.content,
      type: m.type,
      priority: m.priority,
      isPinned: m.isPinned,
      attachments: m.attachments,
      receiverCount: m.receivers.length,
      readCount: m.receipts.filter((r) => r.readAt).length,
      acknowledgedCount: m.receipts.filter((r) => r.acknowledgedAt).length,
      createdAt: m.createdAt,
    }));

    res.status(200).json({ success: true, groupName: group.name, count: shaped.length, messages: shaped });
  } catch (err) { next(err); }
};

// ── Get Pinned Messages ────────────────────────────────────────────────────────
export const getPinnedMessages = async (req, res, next) => {
  try {
    const filter = { receivers: req.user._id, isPinned: true };
    const messages = await Message.find(filter)
      .select("content type priority groupId attachments pinnedAt createdAt")
      .populate("groupId", "name")
      .sort({ pinnedAt: -1 });

    const shaped = messages.map((m) => ({
      _id: m._id,
      content: m.content,
      type: m.type,
      priority: m.priority,
      groupName: m.groupId?.name,
      attachments: m.attachments,
      pinnedAt: m.pinnedAt,
      createdAt: m.createdAt,
    }));

    res.status(200).json({ success: true, count: shaped.length, messages: shaped });
  } catch (err) { next(err); }
};
