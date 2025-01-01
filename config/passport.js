const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;

const GOOGLE_CLIENT_ID =
  "52440688313-3ncbqi41g2l3uvu8f9il1c4v3dgevf41.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3030/auth/google/callback",
      passReqToCallback: true,
    },
    function (request, accessToken, refreshToken, profile, done) {
      // Handle user profile here, like saving it to the database
      console.log("Google profile:", profile);
      return done(null, profile);
    }
  )
);

passport.serializeUser(function (user, done) {
  // Serialize the user for the session
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  // Deserialize the user from the session
  done(null, user);
});

module.exports = passport;
