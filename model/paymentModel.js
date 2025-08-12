//models/paymentsModel.js

const db = require("../Db/Db");

/**
 * Find all recrods for give Loan_no
@param {string} ln_no - Loan_no
@returns {Promsie<Array>} A promise that resolves to an array of payment records.
*/
async function findByloanno(ln_no) {
  const query = `Select * from payment_verification where ln_no = ?`;
  const [rows] = await db.execute(query, [ln_no]);
  return rows;
}

/**
 * Creates a new payment verificatoin record in the database.
 * @param {object} paymentData - an object containing payment details
 * @returns {Promise<object>} A promise that resolves to the database result
 */

async function create(paymentData) {
  const {
    ln_no,
    payment_date,
    receiptUrl,
    amount,
    paymentMethod,
    payer_role,
    comments,
  } = paymentData;
  const query = `
    INSERT INTO payment_verification (ln_no, payment_Date, receipt_url, amount, payment_method, payer_role, comment)
    values(?, ?, ?, ?, ?, ?, ?)`;

  const [result] = await db.execute(query, [
    ln_no,
    payment_date,
    receiptUrl,
    amount,
    paymentMethod,
    payer_role,
    comments,
  ]);
  return result;
}

/**
 * Updates the verification status of a payment record.
 * @param {number} paymentId - The uniquer ID (cfid) of the payment record.
 * @param {number} newStatus - The new verificatons status (0 or 1)
 * @return {Promise <object>} - a promise that resolve to the database result
 */

async function updateStatus(paymentId, newStatus) {
  const query = `
    update payment_verification
    set verification_status = ?
    where cfid = ?;
    `;
  const [result] = await db.execute(query, [newStatus, paymentId]);
  return result;
}

// test update lender comments
async function updateLenderComment(paymentId, lenderComment) {
  const query = `
  update payment_verification
  set comment_lender = ?
  where cfid = ?`;

  const [result] = await db.execute(query, [lenderComment, paymentId]);
  return result;
}
module.exports = {
  findByloanno,
  create,
  updateStatus,
  updateLenderComment,
};
