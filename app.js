// const sessionMiddleware = require("./middleware/sessionMiddleware");
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const db = require("./Db/Db.js");
// auth0 okta
const checkJwt = require("./middleware/auth.js");
// const { PORT } = require("./config/appConfig.js");

//queries import below
const { paymentconfirmation } = require("./queries/paymentConfirmation.js");
const { userDetailsQuery } = require("./queries/user");
const { loansQuery } = require("./queries/loan");
const { paymentDataQuery, recentPaymentsQuery } = require("./queries/payment");
const {
  comingUpQuery,
  loancapitalQuery,
  loanStateQuery,
  currentbalanceQUery,
  loanstateinfoQuery,
} = require("./queries/schedule");

// routes upload
const uploadRoute = require("./controllers/routeUpload");

const app = express();

const PORT = process.env.PORT;

// app.use(sessionMiddleware);
app.use(
  cors({
    origin: "http://localhost:3000", // Adjust this based on your frontend's URL
    methods: ["GET", "POST","PUT"],
    credentials: true, // Allow credentials (cookies, session headers) to be sent
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// use route
app.use("/api/photo", uploadRoute);

const currentDate = new Date();
const date = currentDate.toISOString().split("T")[0];

console.log(date);

// autho okta
app.get("/", (req, res) => {
  res.send("auth0 by okta");
  // console.log(req.query);
});

// auth0_sub
app.get("/sub", async (req, res) => {
  const { auth0_sub } = req.query;
  console.log(auth0_sub);
  try {
    // Query the database
    const query = "SELECT * FROM user WHERE us_auth0_sub = ?";
    const [rows] = await db.query(query, [auth0_sub]);

    if (rows.length > 0) {
      // Successful login
      res.json({
        success: true,
        message: "ID Fetched successful",
        details: rows[0],
      });
      console.log(rows);
    } else {
      // Invalid credentials
      res.status(401).json({ success: false, message: "ID didn't fetched" });
    }
  } catch (error) {
    console.log("Database error:", error);
    res.status(500).json({ error: "An error occurred while logging in" });
  }
});

// Posts

app.post("/update", async (req, res) => {
  const { id, auth0_sub } = req.body;

  if (!id || !auth0_sub) {
    return res.status(400).json({ error: "ID and auth0_sub are required" });
  }

  try {
    // Example SQL query (update it to match your database and setup)
    const query =
      "UPDATE user SET us_auth0_sub = ? WHERE us_id = (SELECT ul_user_id FROM user_lookup WHERE ul_user_code = ?)";
    const params = [auth0_sub, id];

    // Assuming `db` is your database connection
    const result = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "auth0_sub updated successfully" });
  } catch (error) {
    console.error("Error updating auth0_sub:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Login
app.get("/loginn", checkJwt, async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  // Error handling
  app.use((err, req, res, next) => {
    if (err.name === "UnauthorizedError") {
      res.status(401).send("Invalid token");
    } else {
      next(err);
    }
  });
  try {
    // Query the database
    const query =
      "SELECT * FROM user WHERE ul_first_name = ? AND ul_last_name = ?";
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
// Route to fetch Paymentverification
app.get("/paymentverification/:id", async (req, res) => {
  // Extract the LUID from the request parameters
  const luid = req.params.id;

  // Basic validation for the LUID
  if (!luid) {
    return res
      .status(400)
      .json({ success: false, message: "LUID parameter is missing." });
  }

  try {
    const [rows] = await db.execute(paymentconfirmation, [luid]);

    // Check if any records were found
    if (rows.length === 0) {
      return res.status(200).json([]);
    }
    // Return the fetched payment history records as JSON
    res.status(200).json(rows);
  } catch (error) {
    // Log the error on the server side
    console.error("Error fetching payment history:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history.",
      error: error.message,
    });
  }
});

app.use("/", uploadRoute);

// Route to fetch loan no
// Route to fetch loan numbers for a user
app.get("/my-loans/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    // Define the query to fetch distinct loan numbers based on user_id
    const query = `
      SELECT DISTINCT lu_ln_no AS loan_no, lu_nickname AS nickname , lu_role As role
      FROM loanuser
      WHERE lu_user_id = ?;
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
  const loanNo = req.params.loanNo;

  try {
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
      db.query(userDetailsQuery, [loanId]),
      db.query(loansQuery, [loanNo]),
      db.query(comingUpQuery, [loanNo, date]),
      db.query(loancapitalQuery, [loanNo]),
      db.query(loanStateQuery, [loanNo, date]),
      db.query(currentbalanceQUery, [loanNo, date]),
      db.query(loanstateinfoQuery, [loanNo]),
      db.query(paymentDataQuery, [loanNo]),
      db.query(recentPaymentsQuery, [loanNo, date]),
    ]);

    const response = userDetails.reduce((acc, item) => {
      if (!item.role || !item.loan_no) {
        console.warn("Skipping item due to missing role or loan_no:", item);
        return acc;
      }

      const role = item.role.toLowerCase();
      const loanNo = item.loan_no.toLowerCase();

      if (!acc[role]) {
        acc[role] = {};
      }

      const comingup = comingUp.find(
        (comingup) => comingup.loan_no?.toLowerCase() === loanNo
      );
      const capitalForLoan = loan_capital.find(
        (loan) => loan.loan_no?.toLowerCase() === loanNo
      );

      const balance = currentbalance.find(
        (currentbalance) => currentbalance.loan_no?.toLowerCase() === loanNo
      );

      const loanState = loanstate[0];

      const due_history = loanstate
        .filter((row) => row.due_amount > 0)
        .map((row) => ({
          schedule_date: row.schedule_date,
          interest: row.interest,
          principal: row.principal,
          due_amount: row.due_amount,
        }));
      console.log(due_history);

      const loanStateInfo = loanstateinfo.find(
        (info) => info.loan_no?.toLowerCase() === loanNo
      );
      const loan = loans.find((loan) => loan.loan_no?.toLowerCase() === loanNo);
      const paymentBreakdown = paymentData.find(
        (payment) => payment.loan_no?.toLowerCase() === loanNo
      );
      const recentPaymentsForLoan = recentPayments
        .filter((recent) => recent.loan_no?.toLowerCase() === loanNo)
        .map((recent) => ({
          scheduledDate: recent.ScheduledDate,
          scheduledPaidAmount: recent.scheduledPaidAmount,
          actualDate: recent.ActualDate,
          paidAmount: recent.PaidAmount,
          status: recent.Status,
        }));

      acc[role][loanNo] = {
        role: role,
        first_name: item.first_name?.toLowerCase() || "N/A",
        last_name: item.last_name?.toLowerCase() || "N/A",
        nickname: item.nickname?.toLowerCase() || "N/A",
        role: item.role?.toLowerCase() || "N/A",
        coming_up: comingup
          ? {
              ...(balance ? { balance: balance.balance } : 0),
              due_date: comingup.due_date,
              amount_due: comingup.amount_due,
            }
          : {},
        loan_state: loanState
          ? {
              total_due: loanState.total_due_amount,
              schedule_date: loanState.sdchedule_date,
              ...(capitalForLoan
                ? {
                    loan_amount_paid: capitalForLoan.loan_amount_paid,
                    paid_loan: capitalForLoan.balance,
                    loan_schedule_date: capitalForLoan.schedule_date,
                  }
                : {}),
              due_history: due_history,
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
