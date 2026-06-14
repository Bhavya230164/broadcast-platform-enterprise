import mongoose from "mongoose";
import PrivateMessage from "../models/PrivateMessage.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { emitToUser } from "../config/socket.js";

// @desc    Get list of users to chat with (Admins see all, Members see admins)
// @route   GET /api/private-messages/users
export const getChatUsers = async (req, res, next) => {
  try {
    const { role, id: currentUserId } = req.user;
    
    let query = {};
    // Members can only see admins. Admins can see everyone (except themselves).
    if (role === "member") {
      query = { role: "admin", _id: { $ne: currentUserId } };
    } else {
      query = { _id: { $ne: currentUserId } };
    }

    const users = await User.find(query).select("name avatar role isOnline lastSeen email");

    // Fetch the latest message and unread count for each user
    const usersWithChatInfo = await Promise.all(
      users.map(async (user) => {
        const latestMessage = await PrivateMessage.findOne({
          $or: [
            { senderId: currentUserId, receiverId: user._id },
            { senderId: user._id, receiverId: currentUserId },
          ],
        }).sort({ createdAt: -1 });

        const unreadCount = await PrivateMessage.countDocuments({
          senderId: user._id,
          receiverId: currentUserId,
          status: { $ne: "read" },
        });

        return {
          ...user.toJSON(),
          latestMessage,
          unreadCount,
        };
      })
    );

    // Sort users: those with latest messages first
    usersWithChatInfo.sort((a, b) => {
      const dateA = a.latestMessage ? new Date(a.latestMessage.createdAt) : new Date(0);
      const dateB = b.latestMessage ? new Date(b.latestMessage.createdAt) : new Date(0);
      return dateB - dateA;
    });

    res.status(200).json({ success: true, data: usersWithChatInfo });
  } catch (err) {
    next(err);
  }
};

// @desc    Get chat history with a specific user
// @route   GET /api/private-messages/:userId
export const getMessages = async (req, res, next) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user.id;

    const messages = await PrivateMessage.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

// @desc    Send a private message
// @route   POST /api/private-messages/:userId
export const sendMessage = async (req, res, next) => {
  try {
    const { userId: receiverId } = req.params;
    const senderId = req.user.id;
    const { content } = req.body;

    const attachments = req.files?.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      url: `/uploads/files/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
      fileType: file.mimetype.startsWith("image/") ? "image"
        : file.mimetype === "application/pdf" ? "pdf"
        : "document",
    })) || [];

    if (!content && attachments.length === 0) {
      return res.status(400).json({ success: false, message: "Message content or attachments required." });
    }

    const newMessage = await PrivateMessage.create({
      senderId,
      receiverId,
      content,
      attachments,
      status: "sent",
    });

    const populatedMessage = await PrivateMessage.findById(newMessage._id)
      .populate("senderId", "name avatar role")
      .populate("receiverId", "name avatar role");

    const notification = await Notification.create({
      userId: receiverId,
      type: "private_message",
      title: `New message from ${req.user.name}`,
      body: content || (attachments.length ? `${attachments.length} attachment(s)` : ""),
      refId: newMessage._id,
      refModel: "PrivateMessage",
      metadata: {
        senderId,
        senderName: req.user.name,
        attachmentCount: attachments.length,
      },
    });

    emitToUser(receiverId, "receive_private_message", populatedMessage);
    emitToUser(receiverId, "notification_created", notification);

    res.status(201).json({ success: true, data: newMessage });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark messages from a user as read
// @route   PUT /api/private-messages/:userId/read
export const markAsRead = async (req, res, next) => {
  try {
    const { userId: senderId } = req.params;
    const receiverId = req.user.id;

    await PrivateMessage.updateMany(
      { senderId, receiverId, status: { $ne: "read" } },
      { $set: { status: "read" } }
    );
    
    // Notify the sender that their messages were read
    emitToUser(senderId, "private_read_receipt", { readerId: receiverId });

    res.status(200).json({ success: true, message: "Messages marked as read." });
  } catch (err) {
    next(err);
  }
};
