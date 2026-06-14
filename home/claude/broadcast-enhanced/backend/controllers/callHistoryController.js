import CallHistory from "../models/CallHistory.js";

export const getCallHistory = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const filter = isAdmin
      ? {}
      : {
          $or: [
            { caller: req.user._id },
            { receiver: req.user._id }
          ]
        };

    const calls = await CallHistory.find(filter)
      .populate("caller", "name email avatar role")
      .populate("receiver", "name email avatar role")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: calls });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
