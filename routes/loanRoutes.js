// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../Db/Db"); // Your database connection

// Import all necessary SQL query strings
const { userDetailsQuery } = require("../queries/user");
const { loansQuery } = require("../queries/loan");
const { paymentDataQuery, recentPaymentsQuery } = require("../queries/payment");
const {
  comingUpQuery,
  loancapitalQuery,
  loanStateQuery,
  currentbalanceQuery,
  loanstateinfoQuery,
} = require("../queries/schedule");

/**
 * @file This file defines API routes for loan-related operations.
 * It includes routes for fetching a user's loan numbers and detailed loan information.
 */

// Helper to get current date in YYYY-MM-DD format for queries
const getCurrentDateFormatted = () => {
  const currentDate = new Date();
  return currentDate.toISOString().split("T")[0];
};

// Route: GET /my-loans/:id
// Description: Fetches distinct loan numbers and associated roles/nicknames for a given user ID.
router.get("/:id", async (req, res, next) => {
  const userId = req.params.id;

  try {
    const query = `
            SELECT DISTINCT lu_ln_no AS loan_no, lu_nickname AS nickname, lu_role AS role
            FROM loanuser
            WHERE lu_user_id = ?;
        `;
    const [rows] = await db.query(query, [userId]);

    if (rows.length > 0) {
      // Map the loan numbers and send them as a response
      res.status(200).json(rows);
    } else {
      res.status(404).json({ message: "No loans found for this user." });
    }
  } catch (error) {
    console.error("Error fetching loan numbers:", error);
    next(error);
  }
});

// Route: GET /my-loans/:id/loanNo/:loanNo
// Description: Fetches comprehensive details for a specific loan (loanNo) associated with a user (id).
// This route executes multiple queries concurrently to gather all necessary data.
router.get("/:id/loanNo/:loanNo", async (req, res, next) => {
  const userId = req.params.id; // Renamed from loanId to userId for clarity
  const loanNumber = req.params.loanNo; // Renamed from loanNo to loanNumber for clarity

  const currentDate = getCurrentDateFormatted(); // Get formatted current date

  try {
    // Execute all necessary database queries in parallel using Promise.all
    const [
      [userDetails],
      [loans],
      [comingUp],
      [loan_capital],
      [loanstate],
      [currentbalance],
      [loanstateinfo],
      [paymentData],
      [recentPayments],
    ] = await Promise.all([
      db.query(userDetailsQuery, [userId]), // Using userId here
      db.query(loansQuery, [loanNumber]),
      db.query(comingUpQuery, [loanNumber, currentDate]),
      db.query(loancapitalQuery, [loanNumber]),
      db.query(loanStateQuery, [loanNumber, currentDate]),
      db.query(currentbalanceQuery, [loanNumber, currentDate]),
      db.query(loanstateinfoQuery, [loanNumber]),
      db.query(paymentDataQuery, [loanNumber]),
      db.query(recentPaymentsQuery, [loanNumber, currentDate]),
    ]);

    // Process the fetched data to build the final response structure.
    // This part aggregates data from various queries into a structured object.
    const response = userDetails.reduce((acc, item) => {
      // Basic validation for essential properties
      if (!item.role || !item.loan_no) {
        console.warn(
          "Skipping user detail item due to missing role or loan_no:",
          item
        );
        return acc;
      }

      const role = item.role.toLowerCase();
      const currentLoanNo = item.loan_no.toLowerCase(); // Use currentLoanNo for clarity

      // Initialize accumulator for the role if it doesn't exist
      if (!acc[role]) {
        acc[role] = {};
      }

      // Find relevant data for the current loan number from the parallel query results
      const comingupForLoan = comingUp.find(
        (data) => data.loan_no?.toLowerCase() === currentLoanNo
      );
      const capitalForLoan = loan_capital.find(
        (data) => data.loan_no?.toLowerCase() === currentLoanNo
      );
      const balanceForLoan = currentbalance.find(
        (data) => data.loan_no?.toLowerCase() === currentLoanNo
      );
      const loanForLoan = loans.find(
        (data) => data.loan_no?.toLowerCase() === currentLoanNo
      );
      const paymentBreakdownForLoan = paymentData.find(
        (data) => data.loan_no?.toLowerCase() === currentLoanNo
      );
      const loanStateInfoForLoan = loanstateinfo.find(
        (data) => data.loan_no?.toLowerCase() === currentLoanNo
      );

      // Filter loan state history for due amounts
      const dueHistory = loanstate
        .filter(
          (row) =>
            row.loan_no?.toLowerCase() === currentLoanNo && row.due_amount > 0
        )
        .map((row) => ({
          schedule_date: row.schedule_date,
          interest: row.interest,
          principal: row.principal,
          due_amount: row.due_amount,
        }));

      // Filter recent payments for the current loan
      const recentPaymentsFiltered = recentPayments
        .filter((recent) => recent.loan_no?.toLowerCase() === currentLoanNo)
        .map((recent) => ({
          scheduledDate: recent.ScheduledDate,
          scheduledPaidAmount: recent.scheduledPaidAmount,
          actualDate: recent.ActualDate,
          paidAmount: recent.PaidAmount,
          status: recent.Status,
        }));

      // Assemble the final object for the current loan
      acc[role][currentLoanNo] = {
        userId: userId, // Include userId for clarity
        loanNo: currentLoanNo, // Include loanNo for clarity
        first_name: item.first_name?.toLowerCase() || "N/A",
        last_name: item.last_name?.toLowerCase() || "N/A",
        nickname: item.nickname?.toLowerCase() || "N/A",
        role: item.role?.toLowerCase() || "N/A",
        email: item.email?.toLowerCase() || "NA",
        coming_up: comingupForLoan
          ? {
              ...(balanceForLoan
                ? { balance: balanceForLoan.balance }
                : { balance: 0 }),
              due_date: comingupForLoan.due_date,
              amount_due: comingupForLoan.amount_due,
            }
          : { balance: 0, due_date: null, amount_due: 0 }, // Default empty object
        loan_state:
          loanstate.length > 0 &&
          loanstate[0].loan_no?.toLowerCase() === currentLoanNo // Take first relevant loanState entry
            ? {
                total_due: loanstate[0].total_due_amount,
                schedule_date: loanstate[0].sdchedule_date,
                ...(capitalForLoan
                  ? {
                      loan_amount_paid: capitalForLoan.loan_amount_paid,
                      paid_loan: capitalForLoan.balance,
                      loan_schedule_date: capitalForLoan.schedule_date,
                    }
                  : {}),
                due_history: dueHistory,
                loan_state_info: loanStateInfoForLoan || {}, // Add loan state info
              }
            : {},
        loan_details: loanForLoan
          ? {
              loan_amount: loanForLoan.loan_amount,
              interest_rate: loanForLoan.interest_rate,
              contract_date: loanForLoan.contract_date,
              end_date: loanForLoan.end_date,
              status: loanForLoan.status,
              score: loanForLoan.score,
            }
          : {},
        paymentBreakdown: paymentBreakdownForLoan
          ? {
              onTimePayments: paymentBreakdownForLoan.on_time_payments,
              prePayments: paymentBreakdownForLoan.past_due_payments,
              latePayments: paymentBreakdownForLoan.future_payments,
            }
          : {},
        recentPayments: recentPaymentsFiltered,
      };

      return acc;
    }, {});

    res.status(200).json(response); // Send the aggregated response
  } catch (error) {
    console.error("Error fetching detailed loan data:", error);
    next(error); // Pass the error to the centralized error handler
  }
});

module.exports = router;
