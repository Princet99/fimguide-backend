// ping.js

// Import required modules
const express = require("express");
const cron = require("node-cron");
// We are using node-fetch v2, as it's a CommonJS module.
// If you are using ES Modules in your project, you can use a newer version.
const fetch = require("node-fetch");

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
// Replace this with the URL of the website you want to ping.
const WEBSITE_URL_TO_PING = "https://www.google.com";

/**
 * A function that pings the specified website.
 * It sends an HTTP GET request and logs the status.
 */
const pingWebsite = async () => {
  try {
    const response = await fetch(WEBSITE_URL_TO_PING);
    const status = response.status;

    // Log the time and the status of the ping
    console.log(
      `[${new Date().toISOString()}] Pinged ${WEBSITE_URL_TO_PING} - Status: ${status}`
    );

    if (status !== 200) {
      console.warn(`Warning: Website might be down. Status code: ${status}`);
    }
  } catch (error) {
    // Log any errors that occur during the fetch operation
    console.error(
      `[${new Date().toISOString()}] Error pinging ${WEBSITE_URL_TO_PING}:`,
      error.message
    );
  }
};

// --- Cron Job Setup ---
// The cron syntax '*/15 * * * *' means the job will run "at every 15th minute".
// ┌────────────── second (optional)
// │ ┌──────────── minute
// │ │ ┌────────── hour
// │ │ │ ┌──────── day of month
// │ │ │ │ ┌────── month
// │ │ │ │ │ ┌──── day of week
// │ │ │ │ │ │
// * * * * * *
console.log("Scheduler started. The website will be pinged every 15 minutes.");
cron.schedule("*/15 * * * *", () => {
  console.log("Running the ping task as scheduled...");
  pingWebsite();
});

// --- Express Server Routes ---
// A simple root route to confirm the server is running.
app.get("/", (req, res) => {
  res.send("Cron job server is running. Check the console for ping logs.");
});

// A route to manually trigger the ping for testing purposes.
app.get("/ping-now", (req, res) => {
  console.log("Manual ping triggered via /ping-now endpoint.");
  pingWebsite();
  res.send(
    "Ping command has been triggered. Check the console for the result."
  );
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log(
    `You can manually trigger a ping by visiting http://localhost:${PORT}/ping-now`
  );
  // Perform an initial ping when the server starts up.
  console.log("Performing initial ping on server start...");
  pingWebsite();
});
