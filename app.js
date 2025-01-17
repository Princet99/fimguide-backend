const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const db = require("./Db/Db.js");
const authRoutes = require("./routes/auth");
const passport = require("./config/passport");

//queries import below
const { userDetailsQuery } = require("./queries/user");
const { loansQuery } = require("./queries/loan");
const { paymentDataQuery, recentPaymentsQuery } = require("./queries/payment");
const { comingUpQuery, loanStateQuery } = require("./queries/schedule");

const app = express();

const PORT = process.env.PORT;

app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use("/", authRoutes);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const currentDate = new Date();
const date = currentDate.toISOString().split("T")[0];

console.log(date);

// Login
app.get("/login", async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    // Query the database
    const query = "SELECT * FROM user WHERE first_name = ? AND last_name = ?";
    const [rows] = await db.query(query, [username, password]);

    if (rows.length > 0) {
      // Successful login
      res.json({ success: true, message: "Login successful", id: rows[0].id });
      console.log(rows);
    } else {
      // Invalid credentials
      res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }
  } catch (error) {
    console.log("Database error:", error);
    res.status(500).json({ error: "An error occurred while logging in" });
  }
});
// Route to fetch loan no
// Route to fetch loan numbers for a user
app.get("/my-loans/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    // Define the query to fetch distinct loan numbers based on user_id
    const query = `
      SELECT DISTINCT loan_no, nickname
      FROM loan_user
      WHERE user_id = ?;
    `;

    // Execute the query using the MySQL connection
    const [rows] = await db.query(query, [userId]);

    if (rows.length > 0) {
      // Map the loan numbers and send them as a response
      const loanNumbers = rows.map((row) => row);
      res.status(200).json(loanNumbers);
    } else {
      // No loans found for the user
      res.status(404).json({ message: "No loans found for this user" });
    }
  } catch (error) {
    console.error("Error fetching loan numbers:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching loan numbers" });
  }
});

// Route to fetch "My Loans" for a specific user
app.get("/my-loans/:id/loanNo/:loanNo", async (req, res) => {
  const loanId = req.params.id;
  // const role = req.query.role;
  const loanNo = req.params.loanNo;
  // console.log(loanId, " ", role, " ", loanNo, " ");
  // console.log(role);
  try {
    const [
      [userDetails],
      [loans],
      [comingUp],
      [loanstate],
      [paymentData],
      [recentPayments],
    ] = await Promise.all([
      db.query(userDetailsQuery, [loanId]),
      db.query(loansQuery, [loanNo]),
      db.query(comingUpQuery, [loanNo, date]),
      db.query(loanStateQuery, [loanNo, date]),
      db.query(paymentDataQuery, [loanNo]),
      db.query(recentPaymentsQuery, [loanNo, date]),
    ]);

    // log for debugging
    console.log("User Details:", userDetails);
    // console.log("Loans:", loans);
    // console.log("Coming Up:", comingUp);
    // console.log("Payment Data:", paymentData);
    // console.log("Recent Payments:", recentPayments);

    const response = userDetails.reduce((acc, item) => {
      // Determine the role (lender or borrower)
      const role = item.role.toLowerCase(); // 'lender' or 'borrower'
      const loanNo = item.loan_no.toLowerCase();

      // Initialize the nested object for the role if not already present
      if (!acc[role]) {
        acc[role] = {};
      }
      // Find the coming in the coming up array that matches the loan_no
      const comingup = comingUp.find(
        (comingup) => comingup.loan_no.toLowerCase() === loanNo
      );
      // Find the total due amount
      const loanState = loanstate.find(
        (loanstate) => loanstate.loan_no.toLowerCase() === loanNo
      );
      // Find the loan in the loans array that matches the loan_no
      const loan = loans.find((loan) => loan.loan_no.toLowerCase() === loanNo);

      // Find the payment breakdown details below
      const paymentBreakdown = paymentData.find(
        (payment) => payment.loan_no.toLowerCase() === loanNo
      );
      // Find the recent payment details below that matches the loan_no
      // Find all recent payments for the loan_no
      const recentPaymentsForLoan = recentPayments
        .filter((recent) => recent.loan_no.toLowerCase() === loanNo)
        .map((recent) => ({
          scheduledDate: recent.ScheduledDate,
          scheduledPaidAmount: recent.scheduledPaidAmount,
          actualDate: recent.ActualDate,
          paidAmount: recent.PaidAmount,
          status: recent.Status,
        }));

      // Add the current item into the respective role's loan number section
      acc[role][loanNo] = {
        first_name: item.first_name.toLowerCase(),
        last_name: item.last_name.toLowerCase(),
        nickname: item.nickname.toLowerCase(),
        role: item.role.toLowerCase(),
        coming_up: comingup
          ? {
              balance: comingup.balance,
              due_date: comingup.due_date,
              amount_due: comingup.amount_due,
            }
          : {},
        loan_state: loanState
          ? {
              total_due: loanState.total_due_amount,
              loan_balance: loanState.balance,
            }
          : {},
        loan_details: loan
          ? {
              loan_amount: loan.loan_amount,
              interest_rate: loan.interest_rate,
              contract_date: loan.contract_date,
              end_date: loan.end_date,
              status: loan.status,
              score: loan.score,
            }
          : {},
        paymentBreakdown: paymentBreakdown
          ? {
              onTimePayments: paymentBreakdown.on_time_payments,
              prePayments: paymentBreakdown.past_due_payments,
              latePayments: paymentBreakdown.future_payments,
            }
          : {},
        recentPayments: recentPaymentsForLoan,
      };

      return acc;
    }, {});

    res.send(response);
  } catch (error) {
    console.error("Error fetching loan data:", error);
    res.status(500).send({ error: "Failed to fetch loan data" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
