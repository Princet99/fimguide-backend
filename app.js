const express = require("express");
const dotenv = require("dotenv");
dotenv.config(); 

// Import configuration
const appConfig = require("./config/appConfig");

// Import database connection
const db = require("./Db/Db.js"); // Make sure Db.js connects and exports the pool

// Import middleware setup function
const setupMiddleware = require("./middleware/setupMiddleware");
const errorHandler = require("./middleware/errorHandler"); // Centralized error handler

// Import routes setup function
const setupRoutes = require("./routes");

const app = express();

// 1. Setup Global Middleware
// This will configure CORS, body parsers, etc.
setupMiddleware(app);

// 2. Setup Application Routes
// This will apply all your modularized routes to the app.
setupRoutes(app);

// 3. Centralized Error Handling
// This middleware MUST be placed after all other app.use() and app.get/post/etc. calls
// so that it can catch errors from them.
app.use(errorHandler);

// Start the server
const PORT = appConfig.port; // Get port from config

app.listen(PORT, () => {
  console.log(`Server is running in ${appConfig.nodeEnv} mode on port ${PORT}`);
});
