const express = require("express");
const router = express.Router();
const cloudinary = require("../utils/cloudinary"); // Your Cloudinary utility
const upload = require("../middleware/mutler"); // Your Multer middleware
const fs = require("fs"); // Node.js file system module for deleting temp files

// --- Import your existing database connection module ---
// Replace '../config/database' with the actual path to your database connection file
// Assuming it exports a connection pool or client object (e.g., using mysql2/promise or pg)
const db = require("../Db/Db");

// Get:id to view confirmation hisotry tab
router.get("/:id", async (req, res, next) => {
  const luid = req.params.id;

  // Basic validation for LUID parameter
  if (!luid) {
    return res
      .status(400)
      .json({ success: false, message: "LUID parameter is missing " });
  }

  try {
    const viewConfirmation = `SELECT * FROM PaymentVerification WHERE luid = ?;`;

    const [rows] = await db.execute(viewConfirmation, [luid]);

    // If no records are found, return an empty array with a 200 OK status.
    // This indicates that the request was successful, but no data matched.
    if (rows.length === 0) {
      return res.status(200).json([]);
    }
    // if result are found
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching payment verification by LUID", error);
    // Pass the error to the next middleware (errorhandler)
    next(error);
  }
});

// Define the POST route for file upload and data storage
// Use the Multer middleware to handle the file upload
router.post("/upload", upload.single("image"), async function (req, res) {
  // Multer places non-file fields in req.body
  const { luid, payment_date, amount, payer_role, comments } = req.body;

  // Multer places file information in req.file
  const file = req.file;

  // Basic server-side validation
  if (!luid || !payment_date || !amount || !payer_role || !file) {
    // Clean up the temporary file if it exists before sending error response
    if (file && file.path) {
      fs.unlink(file.path, (err) => {
        if (err)
          console.error("Error deleting temp file after validation fail:", err);
      });
    }
    return res.status(400).json({
      success: false,
      message: "LUID, Amount, and Image file are required.",
    });
  }

  // Validate amount is a positive number
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    if (file && file.path) {
      fs.unlink(file.path, (err) => {
        if (err)
          console.error(
            "Error deleting temp file after amount validation fail:",
            err
          );
      });
    }
    return res.status(400).json({
      success: false,
      message: "Amount must be a positive number.",
    });
  }

  try {
    // Upload the file to Cloudinary
    const cloudinaryResult = await cloudinary.uploader.upload(file.path, {
      folder: "payment_receipts", // Optional: specify a folder in Cloudinary
      // Add any other Cloudinary options here (e.g., transformations)
    });

    // Extract necessary data from Cloudinary result
    const receiptUrl = cloudinaryResult.secure_url;
    const publicId = cloudinaryResult.public_id; // Storing public_id is often useful

    // --- Insert data into PaymentVerification SQL table ---
    // Use the imported 'db' connection pool/object to execute the query
    const insertQuery = `
        INSERT INTO PaymentVerification (luid, payment_date, receipt_url, amount, payer_role, comment)
        VALUES (?, ?, ?, ?, ?, ?);
    `;

    // Execute the insert query using the existing database connection
    const [dbResult] = await db.execute(insertQuery, [
      luid,
      payment_date,
      receiptUrl,
      parsedAmount,
      payer_role,
      comments,
    ]); // Use parsedAmount

    // Get the ID of the newly inserted row
    const insertedRecordId = dbResult.insertId; // For MySQL (adjust for PostgreSQL if needed, e.g., dbResult.rows[0].cfid)

    // --- Clean up the temporary file created by Multer ---
    fs.unlink(file.path, (err) => {
      if (err)
        console.error("Error deleting temp file after successful upload:", err);
    });

    // Send success response back to the frontend
    res.status(200).json({
      success: true,
      message: "Payment verification record created successfully!",
      imageUrl: receiptUrl, // Send back the Cloudinary URL
      publicId: publicId, // Send back the Cloudinary public ID
      imageId: insertedRecordId, // Send back the ID from your PaymentVerification table (cfid)
    });
  } catch (err) {
    console.error("Error during upload or database save:", err);

    // --- Clean up the temporary file in case of an error ---
    if (file && file.path) {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Error deleting temp file after upload/DB error:",
            unlinkErr
          );
      });
    }

    // Send error response back to the frontend
    res.status(500).json({
      success: false,
      message: "Upload or database save failed.",
      error: err.message, // Include error message for debugging
    });
  }
});

// --- ADDED: PUT route to update payment verification status ---
// Endpoint: /paymentverification/:id
router.put("/paymentverification/:id", async (req, res) => {
  const paymentId = req.params.id; // Get the record ID from the URL parameters
  const newStatus = req.body.verification_status; // Get the new status from the request body

  // Validate the ID (optional but recommended: check if it's a valid number)
  if (isNaN(parseInt(paymentId, 10))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid payment ID provided." });
  }

  // Basic validation for the status
  if (newStatus === undefined) {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing verification_status (must be 0 or 1).",
    });
  }

  console.log(
    `Received request to update payment ID ${paymentId} to status ${newStatus}`
  );

  try {
    // --- Update the verification_status in the PaymentVerification table ---
    // Assuming 'id' is the primary key column name in your PaymentVerification table
    // and it corresponds to the record.id you're sending from the frontend.
    const updateQuery = `
        UPDATE PaymentVerification
        SET verification_status = ?
        WHERE cfid = ?;
    `;

    // Execute the update query using your existing database connection
    const [dbResult] = await db.execute(updateQuery, [newStatus, paymentId]);

    // Check if any rows were affected (means a record with the given ID was found and updated)
    if (dbResult.affectedRows > 0) {
      console.log(
        `Payment ID ${paymentId} verification status updated successfully.`
      );
      res.status(200).json({
        success: true,
        message: "Verification status updated successfully",
        id: paymentId,
        verification_status: newStatus,
      });
    } else {
      // If affectedRows is 0, no record with that ID was found
      console.warn(`Update failed: Payment ID ${paymentId} not found.`);
      res.status(404).json({
        success: false,
        message: "Payment record not found with the provided ID.",
      });
    }
  } catch (err) {
    console.error("Error updating payment verification status:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating status.",
      error: err.message,
    });
  }
});

module.exports = router;
