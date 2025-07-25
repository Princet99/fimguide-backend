// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController"); // <-- Check this path and variable name

router.put("/:userId/email", userController.updateEmail); // <-- 'userController.updateEmail' should not be undefined

module.exports = router;
