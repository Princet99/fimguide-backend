/**
 * Parses a comma-separated string from an environment variable into an array.
 * @param {string} envVar - The environment variable string (e.g., "http://a.com,http://b.com").
 * @param {string[]} defaultArr - The default array to use if the environment variable is not set.
 * @returns {string[]} An array of origins.
 */
const getCorsOrigins = (envVar, defaultArr) => {
  if (envVar) {
    // Splits the string by commas and trims whitespace from each resulting string.
    return envVar.split(',').map(origin => origin.trim());
  }
  return defaultArr;
};

/**
 * Configuration settings for the Express.js application.
 */
module.exports = {
  // Port on which the server will listen.
  port: process.env.PORT || 5000,

  // CORS origins are parsed into an array, allowing multiple domains.
  corsOrigins: getCorsOrigins(process.env.CORS_ORIGIN, ["https://www.fimdreams.com"]),

  // Application environment mode.
  nodeEnv: process.env.NODE_ENV || "development",
};
