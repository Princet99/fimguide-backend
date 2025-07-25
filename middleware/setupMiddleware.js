// middleware/setupMiddleware.js
const express = require("express");
const cors = require("cors");
const appConfig = require("../config/appConfig"); // Import app configuration

/**
 * Sets up global middleware for the Express application.
 * This includes CORS, JSON body parsing, and URL-encoded body parsing.
 *
 * @param {object} app - The Express application instance.
 */
module.exports = (app) => {
  // Enable CORS for all routes.
  // Configured to allow requests from a specific origin and include credentials.
  app.use(
    cors({
      origin: appConfig.corsOrigin, // Dynamically set from appConfig
      methods: ["GET", "POST", "PUT", "DELETE"], 
      credentials: true, // Allow cookies and authorization headers
    })
  );

  // Middleware to parse JSON bodies from incoming requests.
  // This makes JSON data available on req.body.
  app.use(express.json());

  // Middleware to parse URL-encoded bodies from incoming requests.
  // { extended: false } means it uses the querystring library for parsing.
  app.use(express.urlencoded({ extended: false }));

};
