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
async function sendLenderReminderEmail(
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
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Reminder</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
        /* General styles for email body */
        body {
            font-family: 'Inter', sans-serif, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }

        /* Main container for the email content */
        .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Highlighted box for important details */
        .highlight {
            background-color: #007F86;
            color: white;
            border-radius: 10px;
            padding: 15px 20px;
            font-size: 1em;
            font-weight: bold;
            text-align: center;
            line-height: 1.6;
            margin-top: 10px;
            margin-bottom: 20px;
            /* The following properties make the box shrink-to-fit its content and center it */
            display: table;
            margin-left: auto;
            margin-right: auto;
        }

        /* Default paragraph styling */
        p {
            margin-top: 0;
            margin-bottom: 1em;
            text-align: left;
            font-size: 16px;
            line-height: 1.5;
            color: #333333;
        }

        /* Style for the logo image */
        img {
            display: block;
            border: 0;
        }

        /* Footer  styling */
        .footer {
            border-top: 1px solid #dddddd;
            padding-top: 20px;
            font-size: 12px;
            color: #888888;
            text-align: center;
        }

        .footer p {
            font-size: 12px;
            text-align: center;
            color: #888888;
        }

        .footer a {
            color: #007F86; 
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Greeting and main reminder message -->
        <p>Hello ${loanUserName},<br>
        This is your friendly reminder – you’re scheduled to receive a payment for your <span><b>Loan to ${loanNickname}</b></span>.</p>

        <!-- Highlighted box with due date and amount -->
        <div class="highlight">
            <span>SP#${due_SP} Amount:</span> $${due_amount}<br>
            <span>Date Due:</span> ${formattedDate}
        </div>

        <!-- Follow-up and contact information -->
        <p>You’ll receive another email once confirmation is uploaded to your FiMguide Dashboard. Or if we don’t receive confirmation on time, we’ll let you know the following day.</p>
        <p>If you have any questions or concerns, send a reply to this email or contact Sheri at (424) 262-2022.</p>

        <!-- Closing and signature -->
        <p style="margin-bottom: 20px;">Thank you for using FiMguide!<br><br>
        Sincerely,<br>
        The Team at FiMguide.com</p>

        <!-- Centered logo -->
        <img src="https://raw.githubusercontent.com/Princet99/fimguide-frontend/refs/heads/main/public/logo192.png" width="50" height="50" alt="FiMguide Logo" style="margin: 0 auto 20px auto;">

        <div class="footer">
            <p style="margin: 0;">
                You can manage your email notifications from FiMguide anytime on your dashboard or at: 
                <a href="https://FiMguide.com/notifications" target="_blank" rel="noopener noreferrer">
                    FiMguide.com/notifications
                </a>
            </p>
        </div>
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
  sendLenderReminderEmail,
};
