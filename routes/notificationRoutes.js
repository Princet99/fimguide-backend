// File: routes/notificationRoutes.js

const express = require("express");
const router = express.Router();
const { sendPaymentConfirmationEmail } = require("../services/paymentService"); // We'll create this mock service below

/**
 * @route   POST /api/notify/payment-confirmation
 * @desc    Receives payment details and triggers a confirmation email to an admin.
 * @access  Public (You might want to add authentication middleware here later)
 */
router.post("/payment-confirmation", async (req, res) => {
  // 1. Extract data from the request body sent by the frontend
  const { loanno, amount, paymentDate, comments, imageUrl } = req.body;

  // 2. Basic Validation: Ensure required fields are present
  if (!loanno || !amount || !paymentDate || !imageUrl) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields for notification.",
    });
  }

  // 3. Prepare details for the email service
  const emailDetails = {
    loanno,
    amount,
    paymentDate,
    comments,
    imageUrl,
    // You would typically get the admin email from a config file or environment variable
    recipient: process.env.ADMIN_EMAIL || "admin@yourapp.com",
  };

  try {
    // 4. Call your email service to send the email
    // The sendPaymentConfirmationEmail function will contain the actual email sending logic
    await sendPaymentConfirmationEmail(emailDetails);

    // 5. Send a success response back to the frontend
    res.status(200).json({
      success: true,
      message: "Notification email sent successfully.",
    });
  } catch (error) {
    console.error("Failed to send payment confirmation email:", error);

    // 6. Send an error response if the email service fails
    res.status(500).json({
      success: false,
      message:
        "An internal server error occurred while sending the notification.",
    });
  }
});

module.exports = router;
