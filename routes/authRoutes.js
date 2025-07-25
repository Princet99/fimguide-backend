// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../Db/Db"); // Your database connection
// const checkJwt = require("../middleware/authMiddleware"); // Auth0/Okta JWT middleware not in use haven't setup now

/**
 * @file This file defines authentication-related API routes.
 * These routes handle user authentication, sub-ID fetching, and profile updates.
 */

// Route: GET /
// Description: Simple route to confirm Auth0/Okta integration.
router.get("/", (req, res) => {
  res.send("Auth0 by Okta integration active.");
});

// Route: GET /sub
// Description: Fetches user details based on Auth0 subject ID (us_auth0_sub).
// This is typically used after a user authenticates to check if they exist in your DB.
router.get("/sub", async (req, res, next) => {
  const { auth0_sub } = req.query;

  if (!auth0_sub) {
    return res
      .status(400)
      .json({ success: false, message: "Auth0 sub ID is required." });
  }

  try {
    const query = "SELECT * FROM user WHERE us_auth0_sub = ?";
    const [rows] = await db.query(query, [auth0_sub]);

    if (rows.length > 0) {
      res.json({
        success: true,
        message: "User ID fetched successfully.",
        details: rows[0],
      });
      console.log("User found:", rows[0].us_id);
    } else {
      res.status(404).json({
        success: false,
        message: "User not found with provided Auth0 sub ID.",
      });
    }
  } catch (error) {
    console.error("Database error fetching Auth0 sub:", error);
    // Pass the error to the next middleware (errorHandler)
    next(error);
  }
});

// Route: POST /update
// Description: Updates a user's Auth0 subject ID in the database.
// This might be used to link an existing user record to a new Auth0 identity.
router.post("/update", async (req, res, next) => {
  const { id, auth0_sub } = req.body;
  console.log(id, auth0_sub);

  if (!id || !auth0_sub) {
    return res.status(400).json({
      error: "User ID (id) and Auth0 sub ID (auth0_sub) are required.",
    });
  }

  try {
    const query =
      "UPDATE user SET us_auth0_sub = ? WHERE us_id = (SELECT ul_user_id FROM user_lookup WHERE ul_user_code = ?)";
    const [result] = await db.query(query, [auth0_sub, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found or no changes made.",
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Auth0 sub ID updated successfully." });
  } catch (error) {
    console.error("Error updating Auth0 sub ID:", error);
    next(error);
  }
});

// Route: GET /loginn
// Description: Example login route protected by JWT.
// Note: Actual "login" with username/password should ideally involve hashing and comparing.
// This route demonstrates a protected endpoint after JWT validation.
router.get("/loginn", async (req, res, next) => {
  // In a real application, after checkJwt, user info might be available on req.user.
  // For this example, we're still using query params.
  const { username, password } = req.query;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  try {
    // This query assumes 'ul_first_name' and 'ul_last_name' act as username/password.
    // In a real system, you'd verify hashed passwords.
    const query =
      "SELECT * FROM user WHERE ul_first_name = ? AND ul_last_name = ?";
    const [rows] = await db.query(query, [username, password]);

    if (rows.length > 0) {
      res.json({ success: true, message: "Login successful.", id: rows[0].id });
      console.log("User logged in:", rows[0].id);
    } else {
      res
        .status(401)
        .json({ success: false, message: "Invalid username or password." });
    }
  } catch (error) {
    console.error("Database error during login:", error);
    next(error);
  }
});

module.exports = router;
