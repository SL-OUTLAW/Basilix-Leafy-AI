const { backendPool } = require("./backendDatabase");

async function syncUser(googleUser, role) {
  const client = await backendPool.connect();

  const email = googleUser.email.trim().toLowerCase();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT
        user_id,
        google_sub,
        email
      FROM users
      WHERE google_sub = $1::varchar
         OR LOWER(email) = LOWER($2::varchar)
      FOR UPDATE;
      `,
      [
        googleUser.googleId,
        email
      ]
    );

    if (existing.rows.length > 1) {
      const error = new Error("Google account conflicts with an existing user");
      error.code = "ACCOUNT_LINK_CONFLICT";
      throw error;
    }

    let result;

    if (existing.rows.length === 1) {
      const user = existing.rows[0];

      if (
        user.google_sub &&
        user.google_sub !== googleUser.googleId
      ) {
        const error = new Error("Google account conflicts with an existing user");
        error.code = "ACCOUNT_LINK_CONFLICT";
        throw error;
      }

      result = await client.query(
        `
        UPDATE users
        SET
          google_sub = $1::varchar,
          email = $2::varchar,
          full_name = COALESCE($3::varchar, full_name),
          avatar_url = $4::varchar,
          role = $5::varchar,
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $6
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
          email,
          googleUser.name,
          googleUser.picture,
          role,
          user.user_id
        ]
      );
    } else {
      result = await client.query(
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
          email,
          googleUser.name,
          googleUser.picture,
          role
        ]
      );
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  syncUser
};
