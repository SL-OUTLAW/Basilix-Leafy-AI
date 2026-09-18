const {
  backendPool,
  backendQuery
} = require("./backendDatabase");

async function getAllowedUsers() {
  const result = await backendQuery(`
    SELECT
      a.allowed_user_id,
      a.email,
      a.role,
      a.enabled,
      a.created_at,
      u.full_name,
      u.is_active,
      u.last_login_at
    FROM allowed_users a
    LEFT JOIN users u
      ON LOWER(u.email) = LOWER(a.email)
    ORDER BY a.created_at DESC;
  `);

  return result.rows;
}

async function addAllowedUser(email, role, addedBy) {
  const client = await backendPool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT allowed_user_id
      FROM allowed_users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
      `,
      [email]
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const result = await client.query(
      `
      INSERT INTO allowed_users (
        email,
        role,
        enabled,
        added_by
      )
      VALUES ($1, $2, TRUE, $3)
      RETURNING
        allowed_user_id,
        email,
        role,
        enabled,
        created_at;
      `,
      [email, role, addedBy]
    );

    await client.query(
      `
      UPDATE users
      SET
        role = $1,
        is_active = TRUE,
        updated_at = NOW()
      WHERE LOWER(email) = LOWER($2);
      `,
      [role, email]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function changeUserRole(allowedUserId, role, actingUserId) {
  const client = await backendPool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
      SELECT
        a.allowed_user_id,
        a.email,
        a.role,
        a.enabled,
        a.updated_at,
        u.user_id AS linked_user_id
      FROM allowed_users a
      LEFT JOIN users u
        ON LOWER(u.email) = LOWER(a.email)
      WHERE a.allowed_user_id = $1
      LIMIT 1;
      `,
      [allowedUserId]
    );

    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const oldRole = current.rows[0].role;
    const email = current.rows[0].email;

    if (oldRole === role) {
      await client.query("COMMIT");

      return {
        user: current.rows[0],
        oldRole,
        changed: false
      };
    }

    const isSelf =
      current.rows[0].linked_user_id !== null &&
      String(current.rows[0].linked_user_id) === String(actingUserId);

    if (isSelf && role !== "ADMIN") {
      await client.query("ROLLBACK");

      return {
        blocked: true
      };
    }

    const result = await client.query(
      `
      UPDATE allowed_users
      SET
        role = $1,
        updated_at = NOW()
      WHERE allowed_user_id = $2
      RETURNING
        allowed_user_id,
        email,
        role,
        enabled,
        updated_at;
      `,
      [role, allowedUserId]
    );

    await client.query(
      `
      UPDATE users
      SET
        role = $1,
        updated_at = NOW()
      WHERE LOWER(email) = LOWER($2);
      `,
      [role, email]
    );

    await client.query("COMMIT");

    return {
      user: result.rows[0],
      oldRole,
      changed: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function changeUserStatus(allowedUserId, enabled, actingUserId) {
  const client = await backendPool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
      SELECT
        a.allowed_user_id,
        a.email,
        a.enabled,
        a.role,
        a.updated_at,
        u.user_id AS linked_user_id
      FROM allowed_users a
      LEFT JOIN users u
        ON LOWER(u.email) = LOWER(a.email)
      WHERE a.allowed_user_id = $1
      LIMIT 1;
      `,
      [allowedUserId]
    );

    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const oldEnabled = current.rows[0].enabled;
    const email = current.rows[0].email;

    if (oldEnabled === enabled) {
      await client.query("COMMIT");

      return {
        user: current.rows[0],
        oldEnabled,
        changed: false
      };
    }

    const isSelf =
      current.rows[0].linked_user_id !== null &&
      String(current.rows[0].linked_user_id) === String(actingUserId);

    if (isSelf && enabled === false) {
      await client.query("ROLLBACK");

      return {
        blocked: true
      };
    }

    const result = await client.query(
      `
      UPDATE allowed_users
      SET
        enabled = $1,
        updated_at = NOW()
      WHERE allowed_user_id = $2
      RETURNING
        allowed_user_id,
        email,
        role,
        enabled,
        updated_at;
      `,
      [enabled, allowedUserId]
    );

    await client.query(
      `
      UPDATE users
      SET
        is_active = $1,
        updated_at = NOW()
      WHERE LOWER(email) = LOWER($2);
      `,
      [enabled, email]
    );

    await client.query("COMMIT");

    return {
      user: result.rows[0],
      oldEnabled,
      changed: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeUserAccess(allowedUserId) {
  const client = await backendPool.connect();

  try {
    await client.query("BEGIN");

    const current = await client.query(
      `
      SELECT
        allowed_user_id,
        email,
        role,
        enabled,
        updated_at
      FROM allowed_users
      WHERE allowed_user_id = $1
      LIMIT 1;
      `,
      [allowedUserId]
    );

    if (current.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const accessRecord = current.rows[0];

    await client.query(
      `
      UPDATE users
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE LOWER(email) = LOWER($1);
      `,
      [accessRecord.email]
    );

    await client.query(
      `
      DELETE FROM allowed_users
      WHERE allowed_user_id = $1;
      `,
      [allowedUserId]
    );

    await client.query("COMMIT");

    return accessRecord;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getAllowedUsers,
  addAllowedUser,
  changeUserRole,
  changeUserStatus,
  removeUserAccess
};
