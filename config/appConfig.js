// config/appConfig.js

/**
 * Configuration settings for the Express.js application.
 */
module.exports = {
  // Port on which the server will listen. Defaults to 5000 if not set in environment variables.
  port: process.env.PORT || 5000,

  // CORS (Cross-Origin Resource Sharing) configuration.
  // Specifies which origins are allowed to access your API.
  // In a production environment, this should be the exact URL of your frontend.
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",

  // Environment mode (e.g., 'development', 'production', 'test').
  // Useful for conditional logging or error handling.
  nodeEnv: process.env.NODE_ENV || "development",

  // Other application-wide configurations can go here.
  // For example, API keys, external service URLs, etc.
};
