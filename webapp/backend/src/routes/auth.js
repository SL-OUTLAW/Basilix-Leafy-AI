const express = require("express");

const { verifyGoogleCredential } = require("../services/googleAuth");
const { authorizeAllowedUser } = require("../services/allowedUserAuth");
const { syncUser } = require("../services/userSync");
const { createToken } = require("../services/jwtAuth");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();

router.post("/google", async (req, res) => {
  const { credential } = req.body || {};

  let googleUser;
  let allowedUser;
  let appUser;

  // Step 1: verify the Google identity
  try {
    googleUser = await verifyGoogleCredential(credential);
  } catch (error) {
    if (error.code === "GOOGLE_AUTH_NOT_CONFIGURED") {
      return res.status(500).json({
        authenticated: false,
        error: "Google authentication is not configured"
      });
    }

    return res.status(401).json({
      authenticated: false,
      error: "Invalid Google credential"
    });
  }

  // Step 2: check whether the verified Google user is allowed
  try {
    allowedUser = await authorizeAllowedUser(googleUser.email);

    if (!allowedUser) {
      return res.status(403).json({
        authenticated: false,
        error: "User is not authorized"
      });
    }
  } catch (error) {
    console.error("Allowed user lookup failed:", error);

    return res.status(500).json({
      authenticated: false,
      error: "Authentication failed"
    });
  }

  // Step 3: create or update the application user
  try {
    appUser = await syncUser(googleUser, allowedUser.role);
  } catch (error) {
    console.error("User synchronization failed:", error);

    return res.status(500).json({
      authenticated: false,
      error: "Authentication failed"
    });
  }

  let token;

  try {
    token = createToken(appUser);
  } catch (error) {
    console.error("JWT creation failed:", error);

    return res.status(500).json({
      authenticated: false,
      error: "Authentication failed"
    });
  }

  return res.json({
    authenticated: true,
    token,
    user: {
      ...googleUser,
      role: allowedUser.role
    }
  });
});

router.get("/me", authenticate, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});

module.exports = router;
