import Call from "../models/Call.js";



// @desc     Log a new call (completed, missed, rejected)
// @route    POST /api/calls
export const logCall = async (req, res, next) => {
  try {
    const { receiverId, type, status, duration, startTime, endTime } = req.body;
    const callerId = req.user._id || req.user.id;

    const newCall = await Call.create({
      callerId,
      receiverId,
      type,
      status,
      duration,
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
    });

    return res.status(201).json({ success: true, data: newCall });
  } catch (err) {
    if (next) next(err);
    else return res.status(500).json({ success: false, message: err.message });
  }
};

// @desc     Initialize a real-time WebRTC signaling session 
// @route    POST /api/calls/start
export const logCallStart = async (req, res) => {
  try {
    const { receiverId, type } = req.body;
    const callerId = req.user._id || req.user.id;

    if (!receiverId || !type) {
      return res.status(400).json({ success: false, message: "Missing required call configurations." });
    }

    // Creating call status using your standard Call model
    const call = await Call.create({
      callerId,
      receiverId,
      type,
      status: 'NO_ANSWER', // Default until updated by client handshakes
      startTime: new Date()
    });

    return res.status(201).json({ success: true, data: call });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// @desc     Update active live WebRTC call duration and state boundaries
// @route    PUT /api/calls/:callId/status
export const updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status, duration, endedAt } = req.body;
    
    const call = await Call.findById(req.body.callId || callId);
    if (!call) return res.status(404).json({ success: false, message: "Call log record not found." });

    if (status) call.status = status;
    if (duration !== undefined) call.duration = duration;
    if (endedAt) call.endTime = new Date(endedAt);
    else if (status === 'COMPLETED' || status === 'REJECTED') call.endTime = new Date();

    await call.save();
    return res.status(200).json({ success: true, data: call });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};