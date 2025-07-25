// cron/reminderJob.js
require("dotenv").config();
const pool = require("../Db/Db"); // Adjust path to your DB connection pool
const { sendReminderEmail } = require("../services/emailService"); // Adjust path to your email service

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

  // This query gets all due notifications. It does NOT know the specific payment details yet.
  const [dueReminders] = await connection.execute(
    `
    SELECT
        n.nl_notification_id    AS notification_id,
        nr.nr_ln_no             AS loan_no,
        nr.nr_email             AS toEmail
    FROM
        notifications n
    JOIN notification_rules nr ON n.nl_rule_id = nr.nr_rule_id
    WHERE
        n.nl_status = 'PENDING'
    AND n.nl_scheduled_send_time <= NOW()
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

  for (const reminder of dueReminders) {
    try {
      // For each due reminder, we must now find the CURRENT next unpaid due date for its loan.
      // This is the main logical change from not using nl_sc_id.
      const [paymentDetails] = await connection.execute(
        `
        SELECT
            s.sc_sp_no      AS due_SP,
            s.sc_date       AS dueDate,
            s.sc_due        AS due_amount,
            lu.lu_nickname  AS loanNickname,
            u.us_first_name AS loanUserName
        FROM schedule s
        LEFT JOIN payment p ON s.sc_id = p.pm_sc_id
        JOIN loanuser lu ON s.sc_ln_no = lu.lu_ln_no
        JOIN user u ON lu.lu_id = u.us_id
        WHERE s.sc_ln_no = ?
          AND s.sc_active = 'Y'
          AND p.pm_sc_id IS NULL
        ORDER BY s.sc_date ASC
        LIMIT 1;
        `,
        [reminder.loan_no]
      );

      if (paymentDetails.length === 0) {
        console.log(
          `Skipping notification ${reminder.notification_id} for loan ${reminder.loan_no} as no upcoming payment was found.`
        );
        continue;
      }

      const details = paymentDetails[0];

      // Call the email service function with the dynamically fetched data
      await sendReminderEmail(
        reminder.toEmail,
        details.loanUserName,
        details.due_SP,
        details.loanNickname,
        details.dueDate,
        details.due_amount,
        "Payment Reminder"
      );
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

  // Bulk update statuses for efficiency
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
        AND sc_payor = 1
        AND payment.pm_sc_id IS NULL -- Check for unpaid
      ORDER BY sc_date ASC
      LIMIT 1;
      `,
      [loanNo]
    );

    if (dueRows.length === 0) {
      continue;
    }

    const nextDueDate = dueRows[0];

    const [ruleRows] = await connection.execute(
      `SELECT nr_rule_id FROM notification_rules WHERE nr_ln_no = ? AND nr_is_enabled = 1 LIMIT 1`,
      [loanNo]
    );

    if (ruleRows.length === 0) {
      continue;
    }
    const ruleId = ruleRows[0].nr_rule_id;

    // To prevent duplicates, check if a 'PENDING' notification already exists for this rule.
    const [notificationRows] = await connection.execute(
      `SELECT nl_notification_id FROM notifications WHERE nl_rule_id = ? AND nl_status = 'PENDING'`,
      [ruleId]
    );

    if (notificationRows.length > 0) {
      // A pending notification already exists for this loan's rule, so we skip creating another one.
      continue;
    }

    const dueDate = new Date(nextDueDate.sc_date);
    const scheduledSendTime = new Date(dueDate.setDate(dueDate.getDate() - 7));

    // The INSERT no longer contains nl_sc_id.
    await connection.execute(
      `
      INSERT INTO notifications (nl_rule_id, nl_status, nl_scheduled_send_time)
      VALUES (?, 'PENDING', ?)
      `,
      [ruleId, scheduledSendTime]
    );
    console.log(
      `Scheduled a new reminder for loan ${loanNo} (rule_id: ${ruleId}) on ${scheduledSendTime.toISOString()}`
    );
  }
}

module.exports = { runReminderJob };
