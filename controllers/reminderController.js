// reminderController.js
const emailService = require("../services/emailService");
const reminderModel = require("../model/reminderModel"); // Adjust path as needed

/**
 * Controller function to create a new notification rule.
 * Expected request body: { userId, lnNo, emailId, notificationType, deliveryMethod, isEnabled, intervalDays }
 * Assumes req.user.id is available from authentication middleware.
 */
async function createNotificationRule(req, res) {
  try {
    // Get the ID of the user who is making this request (the 'actor')
    // This assumes your authentication middleware populates req.user.id
    const actingUserId = req.user ? req.user.id : null; // Fallback to null if not authenticated/available

    const {
      userId: ruleOwnerId, // Renamed to clarify this is the user for whom the rule is created
      lnNo,
      emailId,
      notificationType,
      deliveryMethod,
      isEnabled,
      intervalDays,
    } = req.body;

    // Basic validation (can be expanded with Joi/Express-validator)
    if (
      !ruleOwnerId ||
      !lnNo ||
      !emailId ||
      !notificationType ||
      !deliveryMethod
    ) {
      return res
        .status(400)
        .json({ message: "Missing required fields for notification rule." });
    }

    // Pass the actingUserId (who created the rule) to the model function
    const result = await reminderModel.createNotificationRule(
      actingUserId, // The user who triggered this action
      ruleOwnerId, // The user for whom the rule is created (rule's `user_id` column)
      lnNo,
      emailId,
      notificationType,
      deliveryMethod,
      isEnabled,
      intervalDays
    );

    if (result.success) {
      res.status(201).json({
        message: "Notification rule created successfully",
        ruleId: result.ruleId,
      });
    } else {
      // This handles the duplicate entry case specifically from the model
      res.status(409).json({
        message: result.message, // Message from the model about duplicate entry
      });
    }
  } catch (error) {
    console.error("Error in createNotificationRule controller:", error);
    res.status(500).json({
      message: "Internal server error while creating notification rule.",
    });
  }
}

async function createLoanReminder(req, res) {
  try {
    const { loanNo, ruleId } = req.body;

    if (!loanNo || !ruleId) {
      return res.status(400).json({
        message: "Missing required fields: loanNo and ruleId.",
      });
    }

    const result = await reminderModel.scheduleReminderForLoan(loanNo, ruleId);

    if (result.success) {
      res.status(201).json({
        message: "Loan reminder scheduled successfully",
        notificationId: result.notificationId,
      });
    } else {
      res.status(404).json({
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error in createLoanReminder controller:", error.message);
    res.status(500).json({
      message: "Internal server error.",
    });
  }
}

/**
 * Controller function to retrieve a notification by its ID.
 * Expected request params: :id (notification_id)
 * (This function does not modify Notification_rule, so no actingUserId needed)
 */
async function getNotificationById(req, res) {
  try {
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID." });
    }

    const notification = await reminderModel.getNotificationById(
      notificationId
    );

    if (notification) {
      res.status(200).json(notification);
    } else {
      res.status(404).json({ message: "Notification not found." });
    }
  } catch (error) {
    console.error(
      `Error in getNotificationById controller for ID ${req.params.id}:`,
      error.message
    );
    res
      .status(500)
      .json({ message: "Internal server error while fetching notification." });
  }
}

/**
 * Controller function to update an existing notification rule.
 * Expected request params: :id (rule_id)
 * Expected request body: { isEnabled, intervalDays, emailId, lnNo, notificationType, deliveryMethod } (any combination)
 * Assumes req.user.id is available from authentication middleware.
 */
async function updateNotificationRule(req, res) {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const actingUserId = req.user ? req.user.id : null; // Get the ID of the user making this request
    const updates = req.body; // Object containing fields to update

    if (isNaN(ruleId)) {
      return res.status(400).json({ message: "Invalid rule ID." });
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No update fields provided." });
    }

    // Pass the actingUserId (who updated the rule) to the model function
    const result = await reminderModel.updateNotificationRule(
      ruleId,
      actingUserId,
      updates
    );

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      // Handles 'not found' and 'duplicate entry' messages from the model
      if (result.message.includes("not found")) {
        res.status(404).json({ message: result.message });
      } else if (result.message.includes("duplicate rule")) {
        res.status(409).json({ message: result.message });
      } else {
        res
          .status(500)
          .json({ message: "Failed to update notification rule." });
      }
    }
  } catch (error) {
    console.error(
      `Error in updateNotificationRule controller for ID ${req.params.id}:`,
      error.message
    );
    res.status(500).json({
      message: "Internal server error while updating notification rule.",
    });
  }
}

/**
 * Controller function to fetch and process due notifications.
 * This endpoint is typically hit by a background job/cron, not directly by a user.
 * (This function does not modify Notification_rule, so no actingUserId needed)
 */
async function processDueNotifications(req, res) {
  try {
    const dueNotifications = await reminderModel.getDueNotifications();
    console.log(dueNotifications);
    console.log(`Processing ${dueNotifications.length} due notifications...`);

    const processingResults = [];
    for (const notification of dueNotifications) {
      try {
        console.log(
          `Attempting to send notification ID: ${notification.notification_id} for rule: ${notification.rule_id}`
        );

        // Call the actual email sending service
        // Ensure the notification object contains all necessary fields for sendReminderEmail
        const sendSuccess = await emailService.sendReminderEmail(
          notification.email,
          notification.loan_user_name, // l
          notification.due_sp, //sc
          notification.loan_nickname, //lu
          notification.due_date, //sc
          notification.due_amount, //sc
          notification.notification_type
        );

        const status = sendSuccess ? "SENT" : "FAILED"; // sendReminderEmail returns true on success, throws on error
        await reminderModel.updateNotificationStatus(
          notification.notification_id,
          status
        );
        processingResults.push({
          notificationId: notification.notification_id,
          status: status,
          message: sendSuccess ? "Sent" : "Failed",
        });
      } catch (sendError) {
        console.error(
          `Error sending notification ID ${notification.notification_id}:`,
          sendError
        );
        await reminderModel.updateNotificationStatus(
          notification.notification_id,
          "FAILED"
        ); // Mark as failed
        processingResults.push({
          notificationId: notification.notification_id,
          status: "FAILED",
          message: sendError.message,
        });
      }
    }

    res.status(200).json({
      message: `Finished processing ${dueNotifications.length} due notifications.`,
      results: processingResults,
    });
  } catch (error) {
    console.error(
      "Error in processDueNotifications controller:",
      error.message
    );
    res.status(500).json({
      message: "Internal server error while processing due notifications.",
    });
  }
}

/**
 * NEW: Controller function to save or update user-specific notification settings.
 * This will look for an existing rule for a given userId and notificationType.
 * If found, it updates it; otherwise, it creates a new one.
 * Expected request body: { userEmail, receiveNotifications, intervalDays, sc_ln_no, sc_payor }
 */
async function saveNotificationSettings(req, res) {
  try {
    const {
      userId,
      userEmail,
      receiveNotifications,
      sc_ln_no,
      intervalDays = null, // Default to null if not provided
      // sc_payor has been removed
    } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json({ message: "User ID is required in the request body." });
    }

    // ... (rest of your validation)

    const notificationType = "Payment Reminder";
    const deliveryMethod = "Email";

    // CORRECTED: Removed the final argument (sc_payor) from the call
    const result = await reminderModel.upsertNotificationRule(
      userId, // actingUserId
      userId, // rule owner Id
      sc_ln_no,
      userEmail,
      notificationType,
      deliveryMethod,
      receiveNotifications,
      intervalDays
    );

    if (result.success) {
      res.status(200).json({
        message: result.message,
        ruleId: result.ruleId,
      });
    } else {
      res.status(500).json({ message: result.message });
    }
  } catch (error) {
    console.error("Error in saveNotificationSettings controller:", error);
    res.status(500).json({
      message: "Internal server error while saving notification settings.",
    });
  }
}

/**
 * NEW: Controller function to get a specific user's notification settings by userId.
 * CORRECTED: Removed mapping for sc_payor.
 */
async function getNotificationSettingsByUserId(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const notificationType = "Payment Reminder";

    const settings = await reminderModel.getNotificationRuleByUserIdAndType(
      userId,
      notificationType
    );

    if (settings) {
      // Map database fields to frontend expected fields
      const formattedSettings = {
        receiveNotifications: settings.is_enabled,
        intervalDays: settings.interval_days,
        userEmail: settings.email_id,
        sc_ln_no: settings.ln_no,
        // sc_payor field removed as it no longer exists
      };
      res.status(200).json(formattedSettings);
    } else {
      res.status(200).json(null);
    }
  } catch (error) {
    console.error(
      `Error in getNotificationSettingsByUserId controller for ID ${req.params.userId}:`,
      error.message
    );
    res.status(500).json({
      message: "Internal server error while fetching notification settings.",
    });
  }
}

/**
 * NEW: Controller function to get a specific user's notification settings by userId.
 * Expected request params: :userId
 */
async function getNotificationSettingsByUserId(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    // Assuming a specific notification type for these settings (e.g., 'Payment Reminder')
    const notificationType = "Payment Reminder";

    const settings = await reminderModel.getNotificationRuleByUserIdAndType(
      userId,
      notificationType
    );

    if (settings) {
      // Map database fields to frontend expected fields
      const formattedSettings = {
        receiveNotifications: settings.is_enabled,
        intervalDays: settings.interval_days,
        userEmail: settings.email_id, // Include email if needed by frontend
        sc_ln_no: settings.ln_no,
        sc_payor: settings.payor_id, // Assuming payor_id is stored
      };
      res.status(200).json(formattedSettings);
    } else {
      // If no settings found, return default or empty object
      res.status(200).json(null); // Or {} or default settings
    }
  } catch (error) {
    console.error(
      `Error in getNotificationSettingsByUserId controller for ID ${req.params.userId}:`,
      error.message
    );
    res.status(500).json({
      message: "Internal server error while fetching notification settings.",
    });
  }
}

/**
 * NEW: Controller function to get  notification rules.
 * This can be used for admin purposes or general listing.
 */
async function getNotificationRuleByUserId(req, res) {
  try {
    // Get the userId from the request parameters (e.g., /api/notification-rules/123)
    const { id : userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Call the new model function with the userId
    const rule = await reminderModel.getNotificationRuleByUserId(userId);

    if (!rule) {
      // It's okay if a user doesn't have a rule yet.
      return res.status(404).json({ message: "No notification rule found for this user." });
    }

    // Send the found rule back as JSON
    res.status(200).json(rule);
  } catch (error) {
    console.error(
      "Error in getNotificationRuleByUserId controller:",
      error.message
    );
    res.status(500).json({
      message: "Internal server error while fetching the notification rule.",
    });
  }
}

/**
 * NEW: Controller function to delete a notification rule by its ID.
 * Expected request params: :id (rule_id)
 * Assumes req.user.id is available from authentication middleware for authorization.
 */
async function deleteNotificationRule(req, res) {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const actingUserId = req.user ? req.user.id : null; // User performing the delete

    if (isNaN(ruleId)) {
      return res.status(400).json({ message: "Invalid rule ID." });
    }

    const result = await reminderModel.deleteNotificationRule(
      ruleId,
      actingUserId
    );

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      if (result.message.includes("not found")) {
        res.status(404).json({ message: result.message });
      } else {
        res
          .status(500)
          .json({ message: "Failed to delete notification rule." });
      }
    }
  } catch (error) {
    console.error(
      `Error in deleteNotificationRule controller for ID ${req.params.id}:`,
      error.message
    );
    res.status(500).json({
      message: "Internal server error while deleting notification rule.",
    });
  }
}

module.exports = {
  createNotificationRule,
  createLoanReminder,
  getNotificationById,
  updateNotificationRule,
  processDueNotifications,
  saveNotificationSettings,
  getNotificationSettingsByUserId,
  getNotificationRuleByUserId,
  deleteNotificationRule,
};
