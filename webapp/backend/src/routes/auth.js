const express = require("express");

const { verifyGoogleCredential } = require("../services/googleAuth");
const { authorizeAllowedUser } = require("../services/allowedUserAuth");

const router = express.Router();

router.post("/google", async (req, res) => {
  const { credential } = req.body || {};

  let googleUser;

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
    const allowedUser = await authorizeAllowedUser(googleUser.email);

    if (!allowedUser) {
      return res.status(403).json({
        authenticated: false,
        error: "User is not authorized"
      });
    }

    return res.json({
      authenticated: true,
      user: {
        ...googleUser,
        role: allowedUser.role
      }
    });
  } catch (error) {
    console.error("Allowed user lookup failed:", error);

    return res.status(500).json({
      authenticated: false,
      error: "Authentication failed"
    });
  }
});

module.exports = router;
