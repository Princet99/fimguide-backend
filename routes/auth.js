const express = require("express");
const passport = require("passport");
require('./auth')


const router = express.Router();

// Middleware to check if the user is logged in
function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
}

// Authentication routes
router.get("/", (req, res) => {
  res.send('<a href="/auth/google">Authenticate with Google</a>');
});

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/protected", // Successful redirect
    failureRedirect: "/auth/google/failure", // Failure redirect
  })
);




router.get("/protected" , (req, res) => {
  // console.log("Session user:", req.user); // Log the user
  if (!req.user) {
    return res.status(401).send("Unauthorized");
  }
  res.send(`Hello ${req.user.displayName}`);
});


router.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.send("Goodbye!");
  });
});

router.get("/auth/google/failure", (req, res) => {
  res.send("Failed to authenticate..");
});

module.exports = router;
