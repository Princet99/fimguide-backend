// D:\FIM\FIM_LOAN\Backend\cronjob.js
require("dotenv").config();
const cron = require("node-cron");
const { runReminderJob } = require("./cron/reminderJob"); // Make sure this path is correct
const pool = require("./Db/Db"); // Make sure this path is correct

async function startScheduler() {
  console.log("Cron scheduler starting...");

  // Test the database connection once at the start
  try {
    const connection = await pool.getConnection();
    console.log("Database is connected.");
    connection.release();
  } catch (error) {
    console.error(
      "Could not connect to the database. Cron job not started.",
      error
    );
    // Exit if the database isn't available, as the job can't run.
    process.exit(1);
  }

  // --- CRON JOB SCHEDULER ---
  // This schedule runs the job every minute for easy testing.
  // Once you confirm it works, change it to your desired schedule (e.g., '0 8 * * *' for 8 AM).
  cron.schedule("* * * * *", () => {
    console.log(
      `\n[${new Date().toISOString()}] Triggering scheduled reminder job...`
    );
    // We call the function but don't wait for it, allowing the scheduler
    // to be ready for the next run without being blocked.
    runReminderJob();
  });

  console.log("Scheduler is active. Waiting for the next scheduled run.");
  console.log("Press CTRL+C to stop.");
}

// Run the main function to start the scheduler
startScheduler();