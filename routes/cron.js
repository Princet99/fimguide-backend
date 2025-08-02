const express = require("express");
const router = express.Router();
const { reminderJob } = require("../cron//reminderJob");

router.get("/", async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    console.log(req.query.secret);
    console.warn("Forbidden!: Invalid secret token to cron endpoint");
    // Use 403 Forbidden  or 401 unauthroized status
    return res.status(403).json({ message: "Invalid or missing secret token" });
  }

  //   if above case get falls , execute you're scheduler task
  try {
    console.log("console job trigger succesfully");

    // Scheduler Logic here
    await reminderJob();

    res.status(200).json({ message: "cron job executed sucessfully" });
  } catch (error) {
    console.error("Error executing cron job", error);
    res.status(500).json({
      message: "an error occured while executing Cron job execution!",
    });
  }
});

module.exports = router;
