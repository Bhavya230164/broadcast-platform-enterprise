import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Verifies the JWT from the Authorization header.
 * Attaches the full user document to req.user on success.
 * Rejects with 401 if the token is missing, invalid, or expired.
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === "TokenExpiredError"
          ? "Your session has expired. Please log in again."
          : "Invalid token. Please log in again.";
      return res.status(401).json({ success: false, message });
    }

    // Verify the user still exists in the database (handles deleted accounts)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "The account associated with this token no longer exists.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('admin') or requireRole('admin', 'member')
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires the following role(s): ${roles.join(", ")}.`,
      });
    }

    next();
  };
};

// Convenience shorthand middlewares
export const adminOnly = requireRole("admin");
export const memberOnly = requireRole("member");
