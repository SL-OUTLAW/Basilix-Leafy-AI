const express = require("express");
const { rateLimit } = require("express-rate-limit");
const authSessionRoutes = require("./authSession");

const { verifyGoogleCredential } = require("../services/googleAuth");
const { authorizeAllowedUser } = require("../services/allowedUserAuth");
const { syncUser } = require("../services/userSync");
const { createToken } = require("../services/jwtAuth");
const { logAuditEvent } = require("../services/auditLogger");
const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const { createSession } = require("../services/sessionService");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    authenticated: false,
    error: "Too many login attempts. Try again later."
  }
});




router.post("/google", loginLimiter, async (req, res) => {
  const { credential, rememberMe } = req.body || {};

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

    try {
      await logAuditEvent(
        "USER_LOGIN_DENIED",
        "Google login was denied",
        null,
        { reason: "INVALID_GOOGLE_CREDENTIAL" }
      );
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
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
      try {
        await logAuditEvent(
          "USER_LOGIN_DENIED",
          "Verified Google user was not authorized",
          null,
          {
            reason: "NOT_ALLOWED",
            email: googleUser.email
          }
        );
      } catch (auditError) {
        console.error("Audit logging failed:", auditError);
      }

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

  if (!appUser || appUser.is_active !== true) {
    try {
      await logAuditEvent(
        "USER_LOGIN_DENIED",
        "Google login was denied",
        appUser?.user_id || null,
        { reason: "ACCOUNT_INACTIVE" }
      );
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
    }

    return res.status(403).json({
      authenticated: false,
      error: "User is not authorized"
    });
  }

  let token;

  try {
    token = createToken(appUser);

    const session = await createSession(
      appUser.user_id,
      rememberMe === true
    );

    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth"
    };

    if (rememberMe === true) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    res.cookie(
      "leafy_refresh",
      session.refreshToken,
      cookieOptions
    );
  } catch (error) {
    console.error("JWT creation failed:", error);

    return res.status(500).json({
      authenticated: false,
      error: "Authentication failed"
    });
  }

  try {
    await logAuditEvent(
      "USER_LOGIN",
      "User logged in successfully",
      appUser.user_id,
      {
        role: allowedUser.role
      },
      "USER",
      appUser.user_id
    );
  } catch (auditError) {
    console.error("Audit logging failed:", auditError);
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



router.use(authSessionRoutes);

router.get("/me", authenticate, requireRole("OPERATOR", "ADMIN"), (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    authenticated: true,
    user: req.user
  });
});

module.exports = router;
