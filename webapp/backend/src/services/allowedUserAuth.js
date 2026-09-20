const { backendQuery } = require("./backendDatabase");

async function authorizeAllowedUser(email) {
  if (typeof email !== "string") {
    return null;
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const result = await backendQuery(
    `
    SELECT
      allowed_user_id,
      email,
      role,
      enabled
    FROM allowed_users
    WHERE LOWER(email) = $1::varchar
    LIMIT 1;
    `,
    [normalizedEmail]
  );

  const allowedUser = result.rows[0];

  if (
    !allowedUser ||
    allowedUser.enabled !== true
  ) {
    return null;
  }

  return {
    allowedUserId:
      allowedUser.allowed_user_id,
    email: allowedUser.email,
    role: allowedUser.role
  };
}

module.exports = {
  authorizeAllowedUser
};
