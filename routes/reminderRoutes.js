// routes/reminderRoutes.js

const express = require("express");
const router = express.Router();
const reminderController = require("../controllers/reminderController"); // Adjust path to your controller

// Route to create a new notification rule (mapped from your 'addReminder')
// This will create an entry in the Notification_rule table.
router.post("/", reminderController.createNotificationRule);


// Route to manually trigger sending of due reminders (mapped from your 'sendDueReminders')
// This is typically for testing or a cron job.
router.get("/send-due", reminderController.processDueNotifications);

// Route to save/update user-specific notification settings
// This will either create a new rule or update an existing one for the user.
router.post(
  "/notification-settings",
  reminderController.saveNotificationSettings
); // Mapped to the new controller function

// Route to get a specific user's notification settings by userId
router.get(
  "/notification-settings/:userId",
  reminderController.getNotificationSettingsByUserId
); // New GET route

// Route to get  notification rules (new functionality)
router.get("/:id", reminderController.getNotificationRuleByUserId); // Changed to call controller function

// Route to get a specific notification by its ID (mapped from your 'getReminder')
// This fetches an entry from the Notifications table.
router.get("/:id", reminderController.getNotificationById);

// Route to update a notification rule by its ID (mapped from your 'updateReminder')
// This updates an entry in the Notification_rule table.
router.put("/:id", reminderController.updateNotificationRule);


// Route to delete a notification rule by its ID (new functionality)
router.delete("/:id", reminderController.deleteNotificationRule); // Changed to call controller function

module.exports = router;
