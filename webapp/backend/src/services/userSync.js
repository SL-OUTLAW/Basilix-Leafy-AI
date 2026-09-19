const { backendQuery } = require("./backendDatabase");

async function syncUser(googleUser, role) {
  const result = await backendQuery(
    `
    INSERT INTO users (
      google_sub,
      email,
      full_name,
      avatar_url,
      role,
      last_login_at
    )
    VALUES (
      $1::varchar,
      $2::varchar,
      COALESCE($3::varchar, $2::varchar),
      $4::varchar,
      $5::varchar,
      NOW()
    )
    ON CONFLICT (google_sub)
    DO UPDATE SET
      email = EXCLUDED.email,
      full_name = COALESCE($3::varchar, users.full_name),
      avatar_url = EXCLUDED.avatar_url,
      role = EXCLUDED.role,
      last_login_at = NOW(),
      updated_at = NOW()
    RETURNING
      user_id,
      google_sub,
      email,
      full_name,
      avatar_url,
      role,
      is_active,
      last_login_at,
      created_at,
      updated_at;
    `,
    [
      googleUser.googleId,
      googleUser.email,
      googleUser.name,
      googleUser.picture,
      role
    ]
  );

  return result.rows[0];
}

module.exports = {
  syncUser
};