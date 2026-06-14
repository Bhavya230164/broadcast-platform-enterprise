/**
 * 404 handler — catches requests to undefined routes.
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Central error handler.
 * Normalizes all errors into a consistent JSON shape.
 * Stack traces are only included in development mode.
 */
export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "An unexpected server error occurred.";

  // Mongoose document validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(" | ");
  }

  // MongoDB duplicate key (e.g., unique email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `An account with this ${field} already exists.`;
  }

  // Mongoose bad ObjectId (cast error)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}.`;
  }

  // JWT errors (also handled in middleware, but here as a fallback)
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired. Please log in again.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
