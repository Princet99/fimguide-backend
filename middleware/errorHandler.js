// middleware/errorHandler.js

/**
 * Centralized error handling middleware for Express.js.
 * This catches errors thrown by routes or other middleware and sends a standardized response.
 * It also handles specific errors like `UnauthorizedError` from JWT middleware.
 *
 * @param {Error} err - The error object.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function in the stack.
 */
module.exports = (err, req, res, next) => {
  // Log the error for server-side debugging.
  // In production, you might want to use a more robust logging solution.
  console.error("An error occurred:", err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle specific error types, e.g., from JWT validation (like `express-jwt`).
  if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized: Invalid or missing token.";
  }

  // You can add more specific error handling here, e.g., for database errors:
  // if (err.code === 'ER_DUP_ENTRY') { // Example MySQL duplicate entry error
  //     statusCode = 409; // Conflict
  //     message = 'Duplicate entry detected.';
  // }

  // Send a structured JSON error response to the client.
  res.status(statusCode).json({
    success: false,
    message: message,
    // In development, you might want to send more error details for debugging.
    // In production, keep error details minimal to avoid leaking sensitive info.
    ...(process.env.NODE_ENV === "development" && {
      errorDetails: err.message,
      stack: err.stack,
    }),
  });
};
