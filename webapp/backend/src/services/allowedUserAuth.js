const { query } = require("./database");

async function authorizeAllowedUser(email) {
  const result = await query(
    `
    SELECT
      allowed_user_id,
      email,
      role,
      enabled
    FROM allowed_users
    WHERE email = $1
    LIMIT 1;
    `,
    [email]
  );

  const allowedUser = result.rows[0];

  if (!allowedUser || allowedUser.enabled !== true) {
    return null;
  }

  return {
    allowedUserId: allowedUser.allowed_user_id,
    email: allowedUser.email,
    role: allowedUser.role
  };
}

module.exports = {
  authorizeAllowedUser
};
