const express = require("express");
const { verifyGoogleCredential } = require("../services/googleAuth");

const router = express.Router();

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    const user = await verifyGoogleCredential(credential);

    res.json({
      authenticated: true,
      user
    });
  } catch (error) {
    if (error.code === "GOOGLE_AUTH_NOT_CONFIGURED") {
      return res.status(500).json({
        authenticated: false,
        error: "Google authentication is not configured"
      });
    }

    res.status(401).json({
      authenticated: false,
      error: "Invalid Google credential"
    });
  }
});

module.exports = router;