// File: services/emailService.js
// This service uses Nodemailer with Brevo SMTP to send transactional emails.
// Ensure you have 'nodemailer' and 'dotenv' installed:
// npm install nodemailer dotenv

const nodemailer = require("nodemailer");
require("dotenv").config(); // To load variables from a .env file

// 1. Create a transporter using your provided Brevo SMTP details
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // 'false' for port 587, as it uses STARTTLS
  auth: {
    user: process.env.BREVO_SMTP_LOGIN, // Your Brevo account email
    pass: process.env.BREVO_SMTP_KEY, // Your Brevo SMTP Key
  },
});

/**
 * Sends a payment confirmation email using the pre-configured transporter.
 * This function is called by the notification route.
 * @param {object} details - The payment details.
 * @param {string} details.loanno - The loan account number.
 * @param {number} details.amount - The payment amount.
 * @param {string} details.paymentDate - The date of the payment.
 * @param {string} details.comments - Any comments made with the payment.
 * @param {string} details.imageUrl - The URL to the uploaded attachment.
 */
async function sendPaymentConfirmationEmail(details) {
  const { loanno, amount, paymentDate, comments, imageUrl } = details;
  const recipient = "";
  // 2. Define the email options, including a formatted HTML body
  const mailOptions = {
    from: process.env.BREVO_FROM_EMAIL, // Use a sending address authorized by Brevo
    to: recipient,
    subject: `Payment Confirmation Received for Loan: ${loanno}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #333;">Payment Confirmation</h2>
        <p>A payment has been recorded with the following details:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; font-weight: bold;">Loan Account:</td>
            <td style="padding: 8px;">${loanno}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; font-weight: bold;">Amount:</td>
            <td style="padding: 8px;">$${Number(amount).toFixed(2)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; font-weight: bold;">Payment Date:</td>
            <td style="padding: 8px;">${paymentDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; font-weight: bold;">Comments:</td>
            <td style="padding: 8px;">${comments || "N/A"}</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">
          The uploaded attachment can be viewed here:
          <a href="${imageUrl}" style="color: #007bff; text-decoration: none;">View Attachment</a>
        </p>
        <p style="font-size: 0.8em; color: #777;">This is an automated notification. Please do not reply.</p>
      </div>
    `,
  };

  try {
    // 3. Send the email and log the result
    let info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email via Brevo:", error);
    // Re-throw the error so the calling route can handle it and send a 500 response
    throw error;
  }
}

// Export the function so it can be used in your routes
module.exports = {
  sendPaymentConfirmationEmail,
};
