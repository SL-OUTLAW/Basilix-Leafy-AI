const { backendQuery } = require("../services/backendDatabase");

function requireRole(...allowedRoles) {
  return async function (req, res, next) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        authenticated: false,
        error: "Authentication required"
      });
    }

    try {
      const result = await backendQuery(
        `
        SELECT a.role
        FROM users u
        JOIN allowed_users a
          ON LOWER(a.email) = LOWER(u.email)
        WHERE u.user_id = $1
          AND u.is_active = TRUE
          AND a.enabled = TRUE
        LIMIT 1;
        `,
        [req.user.userId]
      );

      if (result.rowCount === 0) {
        return res.status(403).json({
          authenticated: true,
          error: "Access denied"
        });
      }

      const currentRole = result.rows[0].role;

      if (!allowedRoles.includes(currentRole)) {
        return res.status(403).json({
          authenticated: true,
          error: "Insufficient permissions"
        });
      }

      req.user.role = currentRole;
      next();
    } catch (error) {
      console.error("Role authorization failed:", error);

      return res.status(500).json({
        authenticated: false,
        error: "Authorization failed"
      });
    }
  };
}

module.exports = {
  requireRole
};
