import Group from "../models/Group.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { createGroupSchema, updateGroupSchema, addMembersSchema, validate } from "../config/validation.js";
import mongoose from "mongoose";

/**
 * POST /api/groups
 * Admin: Creates a new group, optionally with initial members.
 */
export const createGroup = async (req, res, next) => {
  try {
    const data = validate(createGroupSchema, req.body);

    // Validate that all provided memberIds actually exist and are members
    let validatedMemberIds = [];
    if (data.memberIds.length > 0) {
      const users = await User.find({
        _id: { $in: data.memberIds },
        role: "member",
      }).select("_id");

      validatedMemberIds = users.map((u) => u._id);

      if (validatedMemberIds.length !== data.memberIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more provided member IDs are invalid or do not belong to members.",
        });
      }
    }

    const group = await Group.create({
      name: data.name,
      description: data.description,
      adminId: req.user._id,
      members: validatedMemberIds,
    });

    await group.populate("members", "name email");

    res.status(201).json({
      success: true,
      message: "Group created successfully.",
      group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups
 * Admin: Returns all groups created by this admin, with full member lists.
 */
export const getAdminGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ adminId: req.user._id })
      .populate("members", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/mine
 * Member: Returns groups the member belongs to.
 * PRIVACY: member arrays are deliberately omitted to prevent member discovery.
 */
export const getMemberGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .select("name description createdAt")  // Omit members and adminId
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: groups.length,
      groups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/:id
 * Admin: Gets a single group with full member details.
 */
export const getGroupById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID." });
    }

    const group = await Group.findOne({
      _id: req.params.id,
      adminId: req.user._id,
    }).populate("members", "name email");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or you do not have permission to view it.",
      });
    }

    res.status(200).json({ success: true, group });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/groups/:id
 * Admin: Updates a group's name or description.
 */
export const updateGroup = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID." });
    }

    const data = validate(updateGroupSchema, req.body);

    const group = await Group.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { $set: data },
      { new: true, runValidators: true }
    ).populate("members", "name email");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or you do not have permission to edit it.",
      });
    }

    res.status(200).json({ success: true, message: "Group updated.", group });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/:id/members
 * Admin: Adds one or more members to a group.
 */
export const addMembers = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID." });
    }

    const { memberIds } = validate(addMembersSchema, req.body);

    const group = await Group.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or you do not have permission to modify it.",
      });
    }

    // Verify all memberIds exist and are role=member
    const users = await User.find({ _id: { $in: memberIds }, role: "member" }).select("_id");
    const validIds = users.map((u) => u._id.toString());

    if (validIds.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more provided IDs are invalid or not member-role users.",
      });
    }

    // $addToSet prevents duplicates
    const updatedGroup = await Group.findByIdAndUpdate(
      group._id,
      { $addToSet: { members: { $each: validIds } } },
      { new: true }
    ).populate("members", "name email");

    res.status(200).json({
      success: true,
      message: "Members added successfully.",
      group: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/groups/:id/members/:memberId
 * Admin: Removes a member from a group.
 */
export const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ success: false, message: "Invalid ID(s)." });
    }

    const group = await Group.findOneAndUpdate(
      { _id: id, adminId: req.user._id },
      { $pull: { members: memberId } },
      { new: true }
    ).populate("members", "name email");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or you do not have permission to modify it.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Member removed successfully.",
      group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/groups/:id
 * Admin: Deletes a group and all its messages.
 */
export const deleteGroup = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid group ID." });
    }

    const group = await Group.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found or you do not have permission to delete it.",
      });
    }

    // Cascade delete all messages belonging to this group
    await Message.deleteMany({ groupId: group._id });

    res.status(200).json({
      success: true,
      message: "Group and all associated messages deleted.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/groups/users
 * Admin: Returns all users with the 'member' role (for group management UI).
 */
export const getAllMembers = async (req, res, next) => {
  try {
    const members = await User.find({ role: "member" })
      .select("name email createdAt")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: members.length,
      members,
    });
  } catch (error) {
    next(error);
  }
};
