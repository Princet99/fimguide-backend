// cron/reminderJob.js
require("dotenv").config();
const pool = require("../Db/Db"); //  your DB connection pool
const { sendReminderEmail } = require("../services/paymentReminderB");
const { sendLenderReminderEmail } = require("../services/paymentReminderL");

// --- Main Cron Job Function ---
// This function is the entry point for the cron task.
// It first sends due reminders and then queues up new ones for the future.
async function runReminderJob() {
  console.log("--------------------------------------");
  console.log(`[${new Date().toISOString()}] Running reminder cron job...`);

  const connection = await pool.getConnection(); // Get a single connection for the transaction
  try {
    await connection.beginTransaction();

    // 1. Process and send reminders that are currently due
    await processAndSendDueReminders(connection);

    // 2. Find loans that need a reminder and schedule them
    await scheduleNewReminders(connection);

    await connection.commit(); // Commit all changes if both operations succeed
    console.log(
      `[${new Date().toISOString()}] Reminder job completed successfully.`
    );
  } catch (error) {
    await connection.rollback(); // Roll back changes on any error
    console.error(
      `[${new Date().toISOString()}] Error in reminder cron job:`,
      error.message
    );
  } finally {
    connection.release(); // Always release the connection
    console.log("--------------------------------------\n");
  }
}

// --- Step 1: Process and Send Due Reminders ---
async function processAndSendDueReminders(connection) {
  console.log("Step 1: Checking for due reminders to send...");

  // ✅ **IMPROVEMENT:** Get all required data in one query using the new nl_sc_id link.
  const [dueReminders] = await connection.execute(
    `SELECT
        n.nl_notification_id    AS notification_id,
        nr.nr_email             AS toEmail,
        s.sc_sp_no              AS due_SP,
        s.sc_date               AS dueDate,
        s.sc_due                AS due_amount,
        lu.lu_nickname          AS loanNickname,
        u.us_first_name         AS loanUserName,
        lu.lu_role               AS recipientRole
    FROM
        notifications n
    JOIN notification_rules nr ON n.nl_rule_id = nr.nr_rule_id
    JOIN schedule s ON n.nl_sc_id = s.sc_id
    JOIN loanuser lu ON nr.nr_lu_id = lu.lu_id
    JOIN user u ON lu.lu_id = u.us_id
    WHERE
        n.nl_status = 'PENDING'
    AND n.nl_scheduled_send_time >= NOW()
    AND nr.nr_is_enabled = 1;
    `
  );

  if (dueReminders.length === 0) {
    console.log("No reminders are due for sending at this time.");
    return;
  }

  console.log(`Found ${dueReminders.length} reminder(s) to send.`);
  const sentIds = [];
  const failedIds = [];

  // The loop is now much simpler as we don't need a second query.
  for (const reminder of dueReminders) {
    try {
      if (reminder.recipientRole === "Borrower") {
        await sendReminderEmail(
          reminder.toEmail,
          reminder.loanUserName,
          reminder.due_SP,
          reminder.loanNickname,
          reminder.dueDate,
          reminder.due_amount,
          "Payment Reminder"
        );
      } else if (reminder.recipientRole === "Lender") {
        await sendLenderReminderEmail(
          reminder.toEmail,
          reminder.loanUserName,
          reminder.due_SP,
          reminder.loanNickname,
          reminder.dueDate,
          reminder.due_amount,
          "Upcoming Payment Information"
        );
      } else {
        console.warn(
          `Skipping notification for unhandled role: ${reminder.recipientRole}`
        );
      }
      sentIds.push(reminder.notification_id);
      console.log(
        `Successfully sent reminder for notification ID: ${reminder.notification_id}`
      );
    } catch (error) {
      failedIds.push(reminder.notification_id);
      console.error(
        `Failed to send email for notification ID: ${reminder.notification_id}. Error: ${error.message}`
      );
    }
  }

  // Bulk updates remain the same
  if (sentIds.length > 0) {
    await connection.query(
      "UPDATE notifications SET nl_status = 'SENT', nl_actual_send_time = NOW() WHERE nl_notification_id IN (?)",
      [sentIds]
    );
  }
  if (failedIds.length > 0) {
    await connection.query(
      "UPDATE notifications SET nl_status = 'FAILED' WHERE nl_notification_id IN (?)",
      [failedIds]
    );
  }
}

// --- Step 2: Schedule New Reminders ---
async function scheduleNewReminders(connection) {
  console.log(
    "Step 2: Checking for loans that need new reminders scheduled..."
  );

  const [loans] = await connection.execute(
    `SELECT DISTINCT sc_ln_no FROM schedule WHERE sc_active = 'Y'`
  );

  if (loans.length === 0) {
    console.log("No active loans found to check.");
    return;
  }

  for (const loan of loans) {
    const loanNo = loan.sc_ln_no;

    const [dueRows] = await connection.execute(
      `
      SELECT sc_id, sc_date
      FROM schedule
      LEFT JOIN payment ON payment.pm_sc_id = schedule.sc_id
      WHERE sc_ln_no = ?
        AND sc_active = 'Y'
        AND payment.pm_sc_id IS NULL -- Unpaid check
      ORDER BY sc_date ASC
      LIMIT 1;
      `,
      [loanNo]
    );

    if (dueRows.length === 0) {
      continue;
    }

    const nextDueDate = dueRows[0];
    const scheduleId = nextDueDate.sc_id;

    // This gets ALL enabled rules for the loan (e.g., Borrower and Co-borrower)
    const [ruleRows] = await connection.execute(
      `SELECT nr_rule_id FROM notification_rules WHERE nr_ln_no = ? AND nr_is_enabled = 1`,
      [loanNo]
    );

    if (ruleRows.length === 0) {
      continue;
    }

    // This loop now correctly handles all the logic.
    // It creates one notification record for each person's rule.
    for (const rule of ruleRows) {
      const ruleId = rule.nr_rule_id;

      // Check if a notification for this specific person and this payment already exists
      const [notificationRows] = await connection.execute(
        `SELECT nl_notification_id FROM notifications WHERE nl_sc_id = ? AND nl_rule_id = ?`,
        [scheduleId, ruleId]
      );

      if (notificationRows.length > 0) {
        continue; // Skip if we've already created this one
      }

      const dueDate = new Date(nextDueDate.sc_date);
      const scheduledSendTime = new Date(
        dueDate.setDate(dueDate.getDate() - 7)
      );

      await connection.execute(
        `
        INSERT INTO notifications (nl_rule_id, nl_sc_id, nl_status, nl_scheduled_send_time)
        VALUES (?, ?, 'PENDING', ?)
        `,
        [ruleId, scheduleId, scheduledSendTime]
      );
      console.log(
        `Scheduled a reminder for rule ${ruleId} on loan ${loanNo} (sc_id: ${scheduleId})`
      );
    } // The loop correctly handles everything. Nothing else is needed.
  }
}

module.exports = { runReminderJob };
