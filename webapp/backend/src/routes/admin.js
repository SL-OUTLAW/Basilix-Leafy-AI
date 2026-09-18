const express = require("express");
const validator = require("validator");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const {
  getAllowedUsers,
  addAllowedUser,
  changeUserRole,
  changeUserStatus,
  removeUserAccess
} = require("../services/adminUserService");
const { logAuditEvent } = require("../services/auditLogger");

const router = express.Router();

function isValidEmail(email) {
  return validator.isEmail(email);
}

router.use(
  authenticate,
  requireRole("ADMIN")
);

router.get("/users", async (req, res) => {
  try {
    const users = await getAllowedUsers();

    return res.json({
      users
    });
  } catch (error) {
    console.error("Admin user list failed:", error);

    return res.status(500).json({
      error: "Failed to load users"
    });
  }
});

router.post("/users", async (req, res) => {
  const body = req.body || {};

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const role =
    typeof body.role === "string"
      ? body.role.trim().toUpperCase()
      : "";

  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "Valid email is required"
    });
  }

  if (!["OPERATOR", "ADMIN"].includes(role)) {
    return res.status(400).json({
      error: "Role must be OPERATOR or ADMIN"
    });
  }

  try {
    const user = await addAllowedUser(
      email,
      role,
      req.user.userId
    );

    if (!user) {
      return res.status(409).json({
        error: "User already has access"
      });
    }

    try {
      await logAuditEvent(
        "USER_ALLOWED",
        "User access was added",
        req.user.userId,
        {
          role
        },
        "ALLOWED_USER",
        user.allowed_user_id
      );
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
    }

    return res.status(201).json({
      user
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "User already has access"
      });
    }

    console.error("Admin add user failed:", error);

    return res.status(500).json({
      error: "Failed to add user"
    });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  const allowedUserId = Number(req.params.id);
  const body = req.body || {};

  const role =
    typeof body.role === "string"
      ? body.role.trim().toUpperCase()
      : "";

  if (!Number.isInteger(allowedUserId) || allowedUserId <= 0) {
    return res.status(400).json({
      error: "Invalid user ID"
    });
  }

  if (!["OPERATOR", "ADMIN"].includes(role)) {
    return res.status(400).json({
      error: "Role must be OPERATOR or ADMIN"
    });
  }

  try {
    const result = await changeUserRole(
      allowedUserId,
      role,
      req.user.userId
    );

    if (!result) {
      return res.status(404).json({
        error: "User access record not found"
      });
    }

    if (result.blocked) {
      return res.status(403).json({
        error: "You cannot remove your own admin role"
      });
    }

    if (result.changed) {
      try {
        await logAuditEvent(
          "USER_ROLE_CHANGED",
          "User role was changed",
          req.user.userId,
          {
            oldRole: result.oldRole,
            newRole: role
          },
          "ALLOWED_USER",
          allowedUserId
        );
      } catch (auditError) {
        console.error("Audit logging failed:", auditError);
      }
    }

    return res.json({
      user: result.user
    });
  } catch (error) {
    console.error("Admin role update failed:", error);

    return res.status(500).json({
      error: "Failed to update user role"
    });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  const allowedUserId = Number(req.params.id);
  const body = req.body || {};
  const enabled = body.enabled;

  if (!Number.isInteger(allowedUserId) || allowedUserId <= 0) {
    return res.status(400).json({
      error: "Invalid user ID"
    });
  }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({
      error: "Enabled must be true or false"
    });
  }

  try {
    const result = await changeUserStatus(
      allowedUserId,
      enabled,
      req.user.userId
    );

    if (!result) {
      return res.status(404).json({
        error: "User access record not found"
      });
    }

    if (result.blocked) {
      return res.status(403).json({
        error: "You cannot disable your own admin access"
      });
    }

    if (result.changed) {
      try {
        await logAuditEvent(
          "USER_STATUS_CHANGED",
          "User access status was changed",
          req.user.userId,
          {
            oldEnabled: result.oldEnabled,
            newEnabled: enabled
          },
          "ALLOWED_USER",
          allowedUserId
        );
      } catch (auditError) {
        console.error("Audit logging failed:", auditError);
      }
    }

    return res.json({
      user: result.user
    });
  } catch (error) {
    console.error("Admin status update failed:", error);

    return res.status(500).json({
      error: "Failed to update user status"
    });
  }
});

router.delete("/users/:id", async (req, res) => {
  const allowedUserId = Number(req.params.id);

  if (!Number.isInteger(allowedUserId) || allowedUserId <= 0) {
    return res.status(400).json({
      error: "Invalid user ID"
    });
  }

  try {
    const removed = await removeUserAccess(
      allowedUserId
    );

    if (!removed) {
      return res.status(404).json({
        error: "User access record not found"
      });
    }

    try {
      await logAuditEvent(
        "USER_ACCESS_REMOVED",
        "User access was removed",
        req.user.userId,
        {
          role: removed.role,
          wasEnabled: removed.enabled
        },
        "ALLOWED_USER",
        allowedUserId
      );
    } catch (auditError) {
      console.error("Audit logging failed:", auditError);
    }

    return res.json({
      removed: true
    });
  } catch (error) {
    console.error("Admin remove access failed:", error);

    return res.status(500).json({
      error: "Failed to remove user access"
    });
  }
});

module.exports = router;