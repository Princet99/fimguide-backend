// routes/index.js
const authRoutes = require("./authRoutes");
const loanRoutes = require("./loanRoutes");
const uploadRoutes = require("./uploadRoutes"); // Assuming you've moved/renamed it
const reminderRoutes = require("./reminderRoutes"); // Your existing file
const userRoutes = require("./userRoutes"); // Your existing file
const notificationRoutes = require("./notificationRoutes");
const cron = require("./cron");

/**
 * Configures and applies all defined API routes to the Express application.
 * Each route group is mounted under a specific base path.
 *
 * @param {object} app - The Express application instance.
 */
module.exports = (app) => {
  // API routes for authentication and user related checks (Auth0/Okta)
  app.use("/", authRoutes); // Root path for auth-related checks

  // API routes for file uploads
  app.use("/api/photo", uploadRoutes); // Specific path for photo uploads

  // API routes for user loans and detailed loan information
  app.use("/my-loans", loanRoutes); // Base path for loan-related routes

  // Reminder Routes
  app.use("/api/reminders", reminderRoutes);

  // User Details Routes
  app.use("/users", userRoutes); // Assuming this is correct

  // Use the notification routes
  // All routes in notificationRoutes.js will be prefixed with /api/notify
  app.use("/api/notify", notificationRoutes);

  // Scheduler route for cron , remove if hosting service allows to you to do cron job
  app.use("/api/cron", cron);
};
