//controllers/paymentController.js

const paymentModel = require("../model/paymentModel");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");

/**
 * Handles Requrie to get payment confirmation history
 */

const getConfirmationHistory = async (req, res, next) => {
  try {
    const { id: ln_no } = req.params;
    if (!ln_no) {
      return res
        .status(400)
        .json({ success: false, message: "Loan no parameter is Missing" });
    }

    const records = await paymentModel.findByloanno(ln_no);
    // Return 200 OK , data is available
    res.status(200).json(records);
  } catch (err) {
    console.error("Error in getConfirmationHistory controller:", err);
    next(err);
  }
};

/**
 * Handle the payment receipt upload and data creation
 */

const uploadPayment = async (req, res, next) => {
  const { ln_no, payment_date, amount, paymentMethod, payer_role, comments } =
    req.body;
  const file = req.file;

  //   cleanup function to avoid code repetition
  const cleanupTempFile = (filePath) => {
    if (filePath) {
      fs.unlink(filePath, (err) => {
        if (err) console.error("error deleting temp file:", err);
      });
    }
  };
  //    validation if one of file is Missing or Not uploaded
  console.log(req.body);
  if (
    !ln_no ||
    !payment_date ||
    !amount ||
    !paymentMethod ||
    !payer_role ||
    !comments ||
    !file
  ) {
    cleanupTempFile(file?.path);
    return res.status(400).json({
      success: false,
      message: "Loan no ,Amount and image file are required",
    });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    cleanupTempFile(file?.path);
    return res
      .status(400)
      .json({ success: false, message: "Amount Must be Positive" });
  }

  try {
    const cloudinaryResult = await cloudinary.uploader.upload(file.path, {
      folder: "payment_receipts",
    });

    const paymentData = {
      ln_no,
      payment_date,
      receiptUrl: cloudinaryResult.secure_url,
      amount: parsedAmount,
      paymentMethod,
      payer_role,
      comments,
    };

    const dbResult = await paymentModel.create(paymentData);

    cleanupTempFile(file.path);

    res.status(200).json({
      success: true,
      message: "Payment Verification Record created sucessfully!",
      imageUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      imageId: dbResult.insertId,
    });
  } catch (err) {
    cleanupTempFile(file?.path);
    next(err);
  }
};

/**
 * Handles updating the payment verification status
 */

const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id: paymentId } = req.params;
    const { verification_status: newStatus } = req.body;

    if (isNaN(parseInt(paymentId, 10))) {
      return res
        .status(400)
        .json({ success: false, message: "invalid Payment ID." });
    }
    if (newStatus === undefined) {
      return res.status(400).json({
        success: false,
        message: "verifications status is required.",
      });
    }

    const result = await paymentModel.updateStatus(paymentId, newStatus);

    if (result.affectedRows > 0) {
      res
        .status(200)
        .json({ success: true, message: "Verification status updated" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Payment record not found" });
    }
  } catch (error) {
    console.error("error Updating Payment status:", error);
    next(error);
  }
};

// Handles comments lender

const updateLenderComment = async (req, res, next) => {
  try {
    const { id: paymentId } = req.params;
    const { lender_comment: lenderComment } = req.body;
    console.log(req.body)
    if (lenderComment === undefined) {
      return res.status(400).json({
        success: false,
        message: "Lender Comment is required.",
      });
    }

    const result = await paymentModel.updateLenderComment(
      paymentId,
      lenderComment
    );

    if (result.affectedRows > 0) {
      res
        .status(200)
        .json({ success: true, message: "Verification status updated" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Payment record not found" });
    }
  } catch (error) {
    console.error("error updating Lender Comment:", error);
    next(error);
  }
};

module.exports = {
  getConfirmationHistory,
  uploadPayment,
  updatePaymentStatus,
  updateLenderComment,
};
