// models/reminder.js
const pool = require("../Db/Db"); // Assuming Db.js exports a mysql2 connection pool

/**
 * Creates a new notification rule.
 * @param {string} actingUserId - The ID of the user performing the action (for logging).
 * @param {string} newRuleUserId - The ID of the user for whom the rule is being created.
 * @param {string} lnNo - The loan number associated with the rule.
 * @param {string} emailId - The email address for the notification.
 * @param {string} notificationType - The type of notification (e.g., 'Payment Reminder').
 * @param {string} deliveryMethod - The delivery method (e.g., 'EMAIL', 'SMS').
 * @param {boolean} isEnabled - Whether the rule is enabled.
 * @param {number} intervalDays - The interval in days for the reminder.
 * @param {string} payorId - The payor ID associated with the rule.
 * @returns {Promise<object>} The result of the insertion, including the new rule ID.
 */
async function createNotificationRule(
  actingUserId,
  newRuleUserId,
  lnNo,
  emailId,
  notificationType,
  deliveryMethod,
  isEnabled = false,
  intervalDays = 7
  // payorId has been removed
) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(`SET @session_user_id = ?;`, [actingUserId]);

    // Check for existing rule with the same unique identifiers
    const [existingRule] = await connection.execute(
      `SELECT nr_rule_id FROM notification_rules WHERE nr_user_id = ? AND nr_ln_no = ? AND nr_notification_type = ?`,
      [newRuleUserId, lnNo, notificationType] // CORRECTED: Removed payorId from parameters
    );

    if (existingRule.length > 0) {
      await connection.rollback();
      return {
        success: false,
        message: `A notification rule already exists for this user, loan number, and notification type. Rule ID: ${existingRule[0].nr_rule_id}`,
        ruleId: existingRule[0].nr_rule_id,
      };
    }

    // CORRECTED: nr_payor_id column and its value are removed from the INSERT statement.
    const [result] = await connection.execute(
      `INSERT INTO notification_rules (nr_user_id, nr_ln_no, nr_email, nr_notification_type, nr_delivery_method, nr_is_enabled, nr_interval_days)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newRuleUserId,
        lnNo,
        emailId,
        notificationType,
        deliveryMethod,
        isEnabled,
        intervalDays,
      ] // CORRECTED: Removed payorId from parameters
    );

    await connection.commit();
    console.log(
      `Notification rule created with ID: ${result.insertId} by user: ${actingUserId}`
    );
    return { success: true, ruleId: result.insertId };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (error.code === "ER_DUP_ENTRY") {
      return {
        success: false,
        message: "A duplicate rule entry was detected unexpectedly.",
      };
    }
    console.error("Error creating notification rule:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Schedules a new notification based on an existing rule.
 * This function does NOT modify Notification_rule, so no @session_user_id is needed here.
 * @param {number} ruleId - The ID of the notification rule.
 * @param {Date} scheduledSendTime - The exact timestamp when the notification should be sent.
 * @returns {Promise<object>} The result of the insertion, including the new notification ID.
 */
// new function in your reminderModel
async function scheduleReminderForLoan(loanNo, ruleId) {
    try {
        // 1. Fetch the next due date for the loan
        const [rows] = await pool.execute(
            `SELECT sc_date
             FROM schedule
             LEFT JOIN payment ON payment.pm_sc_id = schedule.sc_id
             WHERE sc_ln_no = ? AND sc_active = 'Y' AND sc_payor = 1
             ORDER BY sc_date ASC
             LIMIT 1`,
            [loanNo]
        );

        if (rows.length === 0) {
            console.log(`No upcoming due date found for loan: ${loanNo}`);
            return { success: false, message: "No upcoming due date." };
        }

        const dueDate = rows[0].sc_date;

        // 2. Calculate the scheduled notification time (e.g., 7 days before)
        const scheduledSendTime = new Date(dueDate);
        scheduledSendTime.setDate(dueDate.getDate() - 7); // Schedule 7 days before the due date

        // 3. Call the existing scheduleNotification model function
        const result = await reminderModel.scheduleNotification(ruleId, scheduledSendTime);
        return result;

    } catch (error) {
        console.error("Error scheduling reminder for loan:", error.message);
        throw error;
    }
}

/**
 * Retrieves notifications that are due to be sent.
 * This function does NOT modify Notification_rule, so no @session_user_id is needed here.
 * This function is typically called by a background process (e.g., cron job).
 * @returns {Promise<Array<object>>} An array of pending notifications that are due.
 */
async function getDueNotifications() {
  try {
    // Adjusted query to use correct column names and join conditions
    const [rows] = await pool.execute(
      `SELECT
                s.sc_SP_no AS due_sp,
                s.sc_date AS due_date,
                s.sc_due AS due_amount,
                lu.lu_nickname AS loan_nickname,
                u.us_first_name AS loan_user_name,
                n.nl_notification_id AS notification_id,
                n.nl_rule_id AS rule_id,
                n.nl_scheduled_send_time AS scheduled_send_time,
                n.nl_status AS status,
                nr.nr_user_id AS user_id,
                nr.nr_ln_no AS ln_no,
                nr.nr_email AS email,
                nr.nr_notification_type AS notification_type,
                nr.nr_delivery_method AS delivery_method,
                nr.nr_interval_days AS interval_days,
                nr.nr_is_enabled AS is_enabled
            FROM schedule AS s
            JOIN loanuser AS lu ON lu.lu_ln_no = s.sc_ln_no
            JOIN user AS u ON u.us_id = lu.lu_id
            JOIN notification_rules AS nr ON nr.nr_ln_no = s.sc_ln_no AND nr.nr_user_id = u.us_id
            JOIN notifications AS n ON n.nl_rule_id = nr.nr_rule_id
            WHERE n.nl_status = 'PENDING'
              AND n.nl_scheduled_send_time <= NOW()
              AND nr.nr_is_enabled = TRUE
            ORDER BY n.nl_scheduled_send_time
            LIMIT 100; -- Limit to a reasonable number for processing in batches
            `
    );
    console.log(`Found ${rows.length} due notifications.`);
    return rows;
  } catch (error) {
    console.error("Error fetching due notifications:", error.message);
    throw error;
  }
}

/**
 * Updates the status of a specific notification.
 * This function does NOT modify Notification_rule, so no @session_user_id is needed here.
 * @param {number} notificationId - The ID of the notification to update.
 * @param {string} status - The new status ('SENT', 'FAILED').
 * @param {Date} [actualSendTime=new Date()] - The actual time the notification was sent/attempted. Defaults to current time.
 * @returns {Promise<object>} The result of the update operation.
 */
async function updateNotificationStatus(
  notificationId,
  status,
  actualSendTime = new Date()
) {
  try {
    const [result] = await pool.execute(
      `UPDATE notifications
             SET nl_status = ?, nl_actual_send_time = ?, nl_updated_at = CURRENT_TIMESTAMP
             WHERE nl_notification_id = ?`,
      [status, actualSendTime, notificationId]
    );
    if (result.affectedRows > 0) {
      console.log(
        `Notification ID ${notificationId} status updated to ${status}.`
      );
      return {
        success: true,
        message: "Notification status updated successfully.",
      };
    } else {
      console.warn(
        `No notification found with ID: ${notificationId} to update.`
      );
      return { success: false, message: "Notification not found." };
    }
  } catch (error) {
    console.error(
      `Error updating notification status for ID ${notificationId}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Retrieves a notification by its ID (for development/debugging).
 * This function does NOT modify Notification_rule, so no @session_user_id is needed here.
 * @param {number} notificationId - The ID of the notification.
 * @returns {Promise<object|null>} The notification object if found, otherwise null.
 */
async function getNotificationById(notificationId) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM notifications WHERE nl_notification_id = ?`,
      [notificationId]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(
      `Error fetching notification by ID ${notificationId}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Updates an existing notification rule.
 * @param {number} ruleId - The ID of the rule to update.
 * @param {string} actingUserId - The ID of the user performing the action (for logging).
 * @param {object} updates - An object containing fields to update (e.g., { isEnabled: true, intervalDays: 10, emailId: 'new@example.com' }).
 * @returns {Promise<object>} The result of the update operation.
 */
async function updateNotificationRule(ruleId, actingUserId, updates) {
  const fields = [];
  const values = [];

  for (const key in updates) {
    if (updates.hasOwnProperty(key)) {
      let dbColumn;
      switch (key) {
        case "isEnabled":
          dbColumn = "nr_is_enabled";
          break;
        case "intervalDays":
          dbColumn = "nr_interval_days";
          break;
        case "userEmail": // From frontend
          dbColumn = "nr_email";
          break;
        case "lnNo": // From frontend (sc_ln_no)
          dbColumn = "nr_ln_no";
          break;
        case "notificationType":
          dbColumn = "nr_notification_type";
          break;
        case "deliveryMethod":
          dbColumn = "nr_delivery_method";
          break;
        case "userId": // From frontend
          dbColumn = "nr_user_id";
          break;
        default:
          console.warn(`Attempted to update unknown field: ${key}. Skipping.`);
          continue; // Skip this key
      }
      fields.push(`${dbColumn} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) {
    return { success: false, message: "No valid fields provided for update." };
  }

  values.push(ruleId); // Add ruleId for the WHERE clause

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(`SET @session_user_id = ?;`, [actingUserId]);

    const [result] = await connection.execute(
      `UPDATE notification_rules
             SET ${fields.join(", ")}, nr_updated_at = CURRENT_TIMESTAMP
             WHERE nr_rule_id = ?`,
      values
    );

    await connection.commit();
    if (result.affectedRows > 0) {
      console.log(
        `Notification rule ID ${ruleId} updated successfully by user: ${actingUserId}.`
      );
      return {
        success: true,
        message: "Notification rule updated successfully.",
      };
    } else {
      console.warn(`No notification rule found with ID: ${ruleId} to update.`);
      return { success: false, message: "Notification rule not found." };
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (error.code === "ER_DUP_ENTRY") {
      console.error(
        "Error updating notification rule: Duplicate entry would be created.",
        error.message
      );
      return {
        success: false,
        message: "Updating these fields would create a duplicate rule.",
      };
    }
    console.error(
      `Error updating notification rule ID ${ruleId}:`,
      error.message
    );
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// --- NEW FUNCTIONS FOR NOTIFICATION SETTINGS ---

/**
 * UPSERT (Update or Insert) a notification rule for user-specific settings.
 * This function will check if a rule for a given user, loan number, notification type, and payor
 * already exists. If it does, it updates it. Otherwise, it creates a new one.
 * @param {string} actingUserId - The ID of the user performing the action (for logging).
 * @param {string} userId - The ID of the user for whom the rule applies.
 * @param {string} lnNo - The loan number.
 * @param {string} emailId - The email address for notifications.
 * @param {string} notificationType - The type of notification.
 * @param {string} deliveryMethod - The delivery method.
 * @param {boolean} isEnabled - Whether the rule is enabled.
 * @param {number} intervalDays - The reminder interval in days.
 * @param {string} payorId - The payor ID.
 * @returns {Promise<object>} The result of the upsert operation.
 */
async function upsertNotificationRule(
  actingUserId,
  userId,
  lnNo,
  emailId,
  notificationType,
  deliveryMethod,
  isEnabled,
  intervalDays
  // payorId has been removed
) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(`SET @session_user_id = ?;`, [actingUserId]);

    // Try to find an existing rule
    const [existingRule] = await connection.execute(
      `SELECT nr_rule_id FROM notification_rules
             WHERE nr_user_id = ? AND nr_ln_no = ? AND nr_notification_type = ?`,
      [userId, lnNo, notificationType] // CORRECTED: Removed payorId from parameters
    );

    if (existingRule.length > 0) {
      // Rule exists, update it
      const ruleIdToUpdate = existingRule[0].nr_rule_id;
      await connection.execute(
        `UPDATE notification_rules
               SET nr_email = ?, nr_is_enabled = ?, nr_interval_days = ?,
                   nr_delivery_method = ?, nr_updated_at = CURRENT_TIMESTAMP
               WHERE nr_rule_id = ?`,
        [emailId, isEnabled, intervalDays, deliveryMethod, ruleIdToUpdate]
      );
      await connection.commit();
      return {
        success: true,
        message: "Notification settings updated successfully.",
        ruleId: ruleIdToUpdate,
      };
    } else {
      // Rule does not exist, create a new one
      // CORRECTED: nr_payor_id column and its value are removed from the INSERT statement.
      const [result] = await connection.execute(
        `INSERT INTO notification_rules (nr_user_id, nr_ln_no, nr_email, nr_notification_type, nr_delivery_method, nr_is_enabled, nr_interval_days, nr_created_by, nr_created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          userId,
          lnNo,
          emailId,
          notificationType,
          deliveryMethod,
          isEnabled,
          intervalDays,
          actingUserId,
        ] // CORRECTED: Removed payorId from parameters
      );
      await connection.commit();
      return {
        success: true,
        message: "Notification settings created successfully.",
        ruleId: result.insertId,
      };
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error in upsertNotificationRule:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


/**
 * Get a specific notification rule for a user by their ID and notification type.
 * @param {string} userId - The ID of the user.
 * @param {string} notificationType - The type of notification.
 * @returns {Promise<object|null>} The notification rule object if found, otherwise null.
 */
async function getNotificationRuleByUserIdAndType(userId, notificationType) {
  try {
    const [rows] = await pool.execute(
      `SELECT
                nr_rule_id AS ruleId,
                nr_user_id AS userId,
                nr_ln_no AS lnNo,
                nr_email AS emailId,
                nr_notification_type AS notificationType,
                nr_delivery_method AS deliveryMethod,
                nr_is_enabled AS isEnabled,
                nr_interval_days AS intervalDays
             FROM notification_rules
             WHERE nr_user_id = ? AND nr_notification_type = ?`,
      [userId, notificationType]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(
      "Error fetching notification rule by user ID and type:",
      error.message
    );
    throw error;
  }
}

/**
 * Get all notification rules (for administrative or listing purposes).
 * @returns {Promise<Array<object>>} An array of all notification rule objects.
 */
async function getNotificationRuleByUserId(userId) {
  try {
    // Use a WHERE clause to find the rule for the specific user
    const [rows] = await pool.execute(
      `SELECT * FROM notification_rules WHERE nr_user_id = ?`,
      [userId] // Pass userId as a parameter to prevent SQL injection
    );
    // Return the first row found, as each user should only have one rule
    return rows[0];
  } catch (error) {
    console.error(
      "Error fetching notification rule by user ID:",
      error.message
    );
    throw error;
  }
}

/**
 * Delete a notification rule by its ID.
 * @param {number} ruleId - The ID of the rule to delete.
 * @param {string} actingUserId - The ID of the user performing the action (for logging).
 * @returns {Promise<object>} The result of the delete operation.
 */
async function deleteNotificationRule(ruleId, actingUserId) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(`SET @session_user_id = ?;`, [actingUserId]);

    const [result] = await connection.execute(
      `DELETE FROM notification_rules WHERE nr_rule_id = ?`,
      [ruleId]
    );

    await connection.commit();
    if (result.affectedRows > 0) {
      console.log(
        `Notification rule ID ${ruleId} deleted by user: ${actingUserId}.`
      );
      return {
        success: true,
        message: "Notification rule deleted successfully.",
      };
    } else {
      console.warn(`No notification rule found with ID: ${ruleId} to delete.`);
      return { success: false, message: "Notification rule not found." };
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error(
      `Error deleting notification rule ID ${ruleId}:`,
      error.message
    );
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  createNotificationRule,
  scheduleReminderForLoan,
  getDueNotifications,
  updateNotificationStatus,
  getNotificationById,
  updateNotificationRule,
  upsertNotificationRule, // Export the new function
  getNotificationRuleByUserIdAndType, // Export the new function
  getNotificationRuleByUserId, // Export the new function
  deleteNotificationRule, // Export the new function
};
