const express = require("express");
const cors = require("cors");
const appConfig = require("../config/appConfig");

/**
 * Sets up global middleware for the Express application.
 * This includes CORS, JSON body parsing, and URL-encoded body parsing.
 *
 * @param {object} app - The Express application instance.
 */
module.exports = (app) => {
  app.use(
    cors({
      // Corrected from 'corsOrigin' to 'corsOrigins'
      origin: appConfig.corsOrigins, 
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
};
