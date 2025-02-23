// middleware/auth.js

const {expressjwt : jwt} = require("express-jwt");
const jwksRsa = require("jwks-rsa");

// Auth0 configuration
const authConfig = {
  domain: "dev-g31r3pdcqu87wc2y.us.auth0.com",
  audience: "http://localhost:3030",
};

// Middleware to validate JWT
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`,
  }),
  audience: authConfig.audience,
  issuer: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

module.exports = checkJwt;
