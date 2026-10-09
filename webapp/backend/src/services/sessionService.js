const crypto = require("crypto");
const { backendQuery } = require("./backendDatabase");

function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

async function createSession(userId, rememberMe = false) {
  const refreshToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashRefreshToken(refreshToken);

  // Remember Me lasts longer.
  const days = rememberMe ? 30 : 1;

  const result = await backendQuery(
    `
    INSERT INTO auth_sessions (
      user_id,
      token_hash,
      remember_me,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3,
      NOW() + ($4 || ' days')::interval
    )
    RETURNING
      session_id,
      remember_me,
      expires_at
    `,
    [userId, tokenHash, rememberMe, days]
  );

  return {
    refreshToken,
    session: result.rows[0]
  };
}

async function refreshSession(refreshToken) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    return null;
  }

  const oldHash = hashRefreshToken(refreshToken);

  // Rotate the refresh token every time it is used.
  const newToken = crypto.randomBytes(32).toString("hex");
  const newHash = hashRefreshToken(newToken);

  const result = await backendQuery(
    `
    UPDATE auth_sessions
    SET
      token_hash = $1,
      last_used_at = NOW()
    WHERE token_hash = $2
      AND revoked_at IS NULL
      AND expires_at > NOW()
    RETURNING
      session_id,
      user_id,
      remember_me,
      expires_at
    `,
    [newHash, oldHash]
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    refreshToken: newToken,
    session: result.rows[0]
  };
}

async function revokeSession(refreshToken) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    return false;
  }

  const result = await backendQuery(
    `
    UPDATE auth_sessions
    SET revoked_at = NOW()
    WHERE token_hash = $1
      AND revoked_at IS NULL
    `,
    [hashRefreshToken(refreshToken)]
  );

  return result.rowCount === 1;
}

module.exports = {
  hashRefreshToken,
  createSession,
  refreshSession,
  revokeSession
};
