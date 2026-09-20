const express = require("express");

const { backendQuery } = require("../services/backendDatabase");
const { authorizeAllowedUser } = require("../services/allowedUserAuth");
const { createToken } = require("../services/jwtAuth");
const {
  refreshSession,
  revokeSession
} = require("../services/sessionService");

const router = express.Router();

function getRefreshToken(req) {
  const cookies = req.headers.cookie || "";

  const cookie = cookies
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith("leafy_refresh="));

  if (!cookie) {
    return null;
  }

  return cookie.substring("leafy_refresh=".length);
}

function cookieOptions(rememberMe = false, expiresAt = null) {
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth"
  };

  if (rememberMe && expiresAt) {
    options.maxAge = Math.max(
      0,
      new Date(expiresAt).getTime() - Date.now()
    );
  }

  return options;
}

router.post("/logout", async (req, res) => {
  const refreshToken = getRefreshToken(req);

  if (refreshToken) {
    try {
      await revokeSession(refreshToken);
    } catch (error) {
      console.error("Logout session revoke failed:", error.message);
    }
  }

  res.clearCookie("leafy_refresh", cookieOptions());

  res.json({
    loggedOut: true
  });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = getRefreshToken(req);

  if (!refreshToken) {
    return res.status(401).json({
      authenticated: false,
      error: "Refresh session required"
    });
  }

  try {
    const refreshed = await refreshSession(refreshToken);

    if (!refreshed) {
      return res.status(401).json({
        authenticated: false,
        error: "Invalid or expired session"
      });
    }

    const result = await backendQuery(
      `
      SELECT
        user_id,
        email,
        full_name,
        role,
        is_active
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [refreshed.session.user_id]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      await revokeSession(refreshed.refreshToken);

      return res.status(401).json({
        authenticated: false,
        error: "Session is no longer authorized"
      });
    }

    const allowedUser = await authorizeAllowedUser(user.email);

    if (!allowedUser) {
      await revokeSession(refreshed.refreshToken);

      return res.status(401).json({
        authenticated: false,
        error: "Session is no longer authorized"
      });
    }

    user.role = allowedUser.role;

    await backendQuery(
      `
      UPDATE users
      SET role = $1, updated_at = NOW()
      WHERE user_id = $2
      `,
      [user.role, user.user_id]
    );

    const token = createToken(user);

    res.cookie(
      "leafy_refresh",
      refreshed.refreshToken,
      cookieOptions(
        refreshed.session.remember_me,
        refreshed.session.expires_at
      )
    );

    res.json({
      authenticated: true,
      token
    });
  } catch (error) {
    console.error("Session refresh failed:", error.message);

    res.status(500).json({
      authenticated: false,
      error: "Session refresh failed"
    });
  }
});

module.exports = router;
