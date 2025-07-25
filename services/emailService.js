// services/emailService.js
// This file provides functions for sending emails using Nodemailer with Brevo SMTP.
// Make sure you have 'nodemailer' installed: npm install nodemailer

const nodemailer = require("nodemailer");
require("dotenv").config(); // Load environment variables

// Create a transporter using Brevo's SMTP details
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com", // Brevo's SMTP host
  port: 587, // Brevo's recommended port for TLS (STARTTLS)
  secure: false, // Use 'false' for port 587 (it will upgrade to TLS automatically)
  // If you use port 465, set secure: true
  auth: {
    user: process.env.BREVO_SMTP_LOGIN, // Brevo SMTP Login (usually your Brevo account email)
    pass: process.env.BREVO_SMTP_KEY, // Brevo SMTP Key (NOT your API Key or account password)
  },
});

// Function to send a detailed reminder email
async function sendReminderEmail(
  toEmail,
  loanUserName,
  due_SP,
  loanNickname,
  dueDate, // This is the schedule's due_date
  due_amount,
  reminderEventName // This is the event_name from the reminder table (though not used in template)
) {
  // Ensure date is formatted YYYY-MM-DD
  const date = new Date(dueDate);
  // Format the date as "Month DD, YYYY"
  const options = { year: "numeric", month: "long", day: "numeric" };
  const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date);

  const mailOptions = {
    from: process.env.BREVO_FROM_EMAIL, // This MUST be a VERIFIED sender email in your Brevo account
    to: toEmail,
    subject: `Payment Reminder`, // More specific subject
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Payment Reminder</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            text-align: center;
        }

        .highlight {
            background-color: #007F86;
            color: white;
            border-radius: 10px;
            padding: 9px 15px;
            font-size: 1em;
            font-weight: bold;
            text-align: left;
            line-height: 1.6;
            display: inline-block;
        }

        p {
            margin-bottom: 1em;
            text-align: left;
        }

        img {
            display: block;
            margin: 20px 0 0 0;
            float: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <p>Hello ${loanUserName},<br>
        Just a friendly reminder that <b>SP# ${due_SP}</b> for your <span><b>${loanNickname}</b></span> is coming up.</p>

        <div class="highlight">
            <span>SP#${due_SP} Amount:</span> $${due_amount}<br>
            <span>Date Due:</span> ${formattedDate}
        </div>

        <p>Don't forget to upload confirmation of your payment on your FiMguide Dashboard. A Late Fee and Added Interest will be assessed if confirmation is not received by the end of the Grace Period.</br></br>
        If you have any questions or concerns, send a reply to this email or contact Sheri at (424) 262-2022.</p>

        <p style="margin: 0;">Thank you for using FiMguide!<br><br>
        Sincerely,<br>
        The Team at FiMguide.com</p>

        <img src="https://raw.githubusercontent.com/Princet99/fimguide-frontend/refs/heads/main/public/logo192.png" width="50px" height="50px" alt="FiMguide Logo">
    </div>
</body>
</html>
`,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("Detailed reminder email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending detailed reminder email:", error.message);
    // console.error("Error sending detailed reminder email:", error);
    throw error;
  }
}

module.exports = {
  sendReminderEmail,
};
