// routes/paymentRoutes.js

const express = require("express");
const router = express.Router();

// Import middleware
const upload = require("../middleware/mutler");

// Import controller functions
const paymentController = require("../controllers/paymentController");

// API ROUTES

// GET History By loan no
router.get("/:id", paymentController.getConfirmationHistory);

// Post a new payment with an image upload
router.post("/upload", upload.single("image"), paymentController.uploadPayment);

// PUT to update the verification status
router.put("/paymentverification/:id", paymentController.updatePaymentStatus);

// PUT to update the lender_comment
router.put("/lendercomment/:id", paymentController.updateLenderComment);

module.exports = router;
