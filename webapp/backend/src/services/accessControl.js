const { backendQuery } = require("./backendDatabase");

const DEFAULT_PERMISSIONS = {
  EMERGENCY_STOP: "ADMIN",
  CLEAR_EMERGENCY_STOP: "ADMIN",
  AI_TOGGLE: "ADMIN",
  APPROVAL_REVIEW: "ADMIN",
  MANUAL_CONTROLS: "OPERATOR",
  DOSING_TARGETS: "ADMIN",
  SCHEDULE_MANAGE: "OPERATOR",
  GROW_CYCLE_MANAGE: "OPERATOR",
  HARVEST_RECORD: "OPERATOR",
  SETTINGS_MANAGE: "ADMIN"
};

async function ensureAccessControlDefaults() {
  for (const [permissionKey, accessLevel] of Object.entries(DEFAULT_PERMISSIONS)) {
    await backendQuery(
      `
      INSERT INTO feature_permissions (
        permission_key,
        access_level,
        description
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (permission_key) DO NOTHING;
      `,
      [
        permissionKey,
        accessLevel,
        permissionKey
          .toLowerCase()
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      ]
    );
  }
}

async function getPermissions() {
  await ensureAccessControlDefaults();

  const result = await backendQuery(`
    SELECT
      permission_key,
      access_level,
      description,
      updated_at
    FROM feature_permissions
    ORDER BY permission_key ASC;
  `);

  return result.rows;
}

async function getPermissionMap() {
  const rows = await getPermissions();

  return Object.fromEntries(
    rows.map((row) => [row.permission_key, row.access_level])
  );
}

function roleAllowed(role, accessLevel) {
  if (accessLevel === "ALL") {
    return role === "OPERATOR" || role === "ADMIN";
  }

  if (accessLevel === "OPERATOR") {
    return role === "OPERATOR" || role === "ADMIN";
  }

  return role === "ADMIN";
}

function requirePermission(permissionKey) {
  return async function permissionMiddleware(req, res, next) {
    try {
      await ensureAccessControlDefaults();

      const result = await backendQuery(
        `
        SELECT access_level
        FROM feature_permissions
        WHERE permission_key = $1
        LIMIT 1;
        `,
        [permissionKey]
      );

      const accessLevel =
        result.rows[0]?.access_level ||
        DEFAULT_PERMISSIONS[permissionKey] ||
        "ADMIN";

      if (!roleAllowed(req.user?.role, accessLevel)) {
        return res.status(403).json({
          authenticated: true,
          error: "You do not have permission to perform this action",
          permission: permissionKey
        });
      }

      next();
    } catch (error) {
      console.error("Permission authorization failed:", error);

      return res.status(500).json({
        authenticated: true,
        error: "Permission authorization failed"
      });
    }
  };
}

module.exports = {
  DEFAULT_PERMISSIONS,
  ensureAccessControlDefaults,
  getPermissions,
  getPermissionMap,
  requirePermission,
  roleAllowed
};
