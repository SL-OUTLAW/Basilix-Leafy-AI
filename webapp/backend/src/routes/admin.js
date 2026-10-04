const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const { backendQuery } = require("../services/backendDatabase");
const { logAuditEvent } = require("../services/auditLogger");
const {
  ensureAccessControlDefaults,
  getPermissions
} = require("../services/accessControl");

const router = express.Router();

router.use(authenticate, requireRole("ADMIN"));

router.get("/users", async (req, res) => {
  try {
    const result = await backendQuery(`
      SELECT
        a.allowed_user_id,
        a.email,
        a.role,
        a.enabled,
        a.created_at,
        a.updated_at,
        u.user_id,
        u.full_name,
        u.avatar_url,
        u.is_active,
        u.last_login_at
      FROM allowed_users a
      LEFT JOIN users u
        ON LOWER(u.email) = LOWER(a.email)
      ORDER BY a.role DESC, a.email ASC;
    `);

    res.json({ users: result.rows });
  } catch (error) {
    console.error("Admin user list failed:", error);
    res.status(500).json({ error: "Unable to load users" });
  }
});

router.post("/users", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = String(req.body?.role || "OPERATOR").toUpperCase();

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  if (!["OPERATOR", "ADMIN"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const result = await backendQuery(
      `
      INSERT INTO allowed_users (
        email,
        role,
        enabled,
        added_by
      )
      VALUES ($1, $2, TRUE, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        role = EXCLUDED.role,
        enabled = TRUE,
        updated_at = NOW()
      RETURNING *;
      `,
      [email, role, req.user.userId]
    );

    await logAuditEvent(
      "ADMIN_USER_ACCESS_UPDATED",
      "Admin added or re-enabled an allowed user",
      req.user.userId,
      { email, role },
      "ALLOWED_USER",
      result.rows[0].allowed_user_id
    ).catch((error) => console.error("Audit logging failed:", error));

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error("Admin add user failed:", error);
    res.status(500).json({ error: "Unable to add user" });
  }
});

router.patch("/users/:allowedUserId", async (req, res) => {
  const allowedUserId = Number(req.params.allowedUserId);
  const role = req.body?.role
    ? String(req.body.role).toUpperCase()
    : null;
  const enabled =
    typeof req.body?.enabled === "boolean"
      ? req.body.enabled
      : null;

  if (!Number.isInteger(allowedUserId) || allowedUserId < 1) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (role && !["OPERATOR", "ADMIN"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const current = await backendQuery(
      `SELECT * FROM allowed_users WHERE allowed_user_id = $1 LIMIT 1;`,
      [allowedUserId]
    );

    if (!current.rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      current.rows[0].email.toLowerCase() === String(req.user.email).toLowerCase() &&
      (enabled === false || role === "OPERATOR")
    ) {
      return res.status(400).json({
        error: "You cannot remove your own admin access"
      });
    }

    const result = await backendQuery(
      `
      UPDATE allowed_users
      SET
        role = COALESCE($2, role),
        enabled = COALESCE($3, enabled),
        updated_at = NOW()
      WHERE allowed_user_id = $1
      RETURNING *;
      `,
      [allowedUserId, role, enabled]
    );

    if (enabled === false) {
      await backendQuery(
        `
        UPDATE users
        SET is_active = FALSE, updated_at = NOW()
        WHERE LOWER(email) = LOWER($1);
        `,
        [result.rows[0].email]
      );
    } else {
      await backendQuery(
        `
        UPDATE users
        SET
          is_active = TRUE,
          role = $2,
          updated_at = NOW()
        WHERE LOWER(email) = LOWER($1);
        `,
        [result.rows[0].email, result.rows[0].role]
      );
    }

    await logAuditEvent(
      "ADMIN_USER_ACCESS_UPDATED",
      "Admin changed user access",
      req.user.userId,
      {
        email: result.rows[0].email,
        role: result.rows[0].role,
        enabled: result.rows[0].enabled
      },
      "ALLOWED_USER",
      allowedUserId
    ).catch((error) => console.error("Audit logging failed:", error));

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Admin update user failed:", error);
    res.status(500).json({ error: "Unable to update user" });
  }
});

router.delete("/users/:allowedUserId", async (req, res) => {
  const allowedUserId = Number(req.params.allowedUserId);

  try {
    const current = await backendQuery(
      `SELECT * FROM allowed_users WHERE allowed_user_id = $1 LIMIT 1;`,
      [allowedUserId]
    );

    if (!current.rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    if (current.rows[0].email.toLowerCase() === String(req.user.email).toLowerCase()) {
      return res.status(400).json({ error: "You cannot remove your own access" });
    }

    await backendQuery(
      `DELETE FROM allowed_users WHERE allowed_user_id = $1;`,
      [allowedUserId]
    );

    await backendQuery(
      `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE LOWER(email) = LOWER($1);`,
      [current.rows[0].email]
    );

    await logAuditEvent(
      "ADMIN_USER_REMOVED",
      "Admin removed an allowed user",
      req.user.userId,
      { email: current.rows[0].email },
      "ALLOWED_USER",
      allowedUserId
    ).catch((error) => console.error("Audit logging failed:", error));

    res.status(204).end();
  } catch (error) {
    console.error("Admin remove user failed:", error);
    res.status(500).json({ error: "Unable to remove user" });
  }
});

router.get("/permissions", async (req, res) => {
  try {
    await ensureAccessControlDefaults();
    res.json({ permissions: await getPermissions() });
  } catch (error) {
    console.error("Admin permissions load failed:", error);
    res.status(500).json({ error: "Unable to load permissions" });
  }
});

router.patch("/permissions/:permissionKey", async (req, res) => {
  const permissionKey = String(req.params.permissionKey || "").toUpperCase();
  const accessLevel = String(req.body?.access_level || "").toUpperCase();

  if (!["ALL", "OPERATOR", "ADMIN"].includes(accessLevel)) {
    return res.status(400).json({ error: "Invalid access level" });
  }

  try {
    await ensureAccessControlDefaults();

    const result = await backendQuery(
      `
      UPDATE feature_permissions
      SET access_level = $2, updated_at = NOW()
      WHERE permission_key = $1
      RETURNING *;
      `,
      [permissionKey, accessLevel]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Permission not found" });
    }

    await logAuditEvent(
      "ADMIN_PERMISSION_UPDATED",
      "Admin changed a feature permission",
      req.user.userId,
      { permission_key: permissionKey, access_level: accessLevel },
      "FEATURE_PERMISSION"
    ).catch((error) => console.error("Audit logging failed:", error));

    res.json({ permission: result.rows[0] });
  } catch (error) {
    console.error("Admin permission update failed:", error);
    res.status(500).json({ error: "Unable to update permission" });
  }
});

module.exports = router;
