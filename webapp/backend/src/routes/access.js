const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const { getPermissionMap, roleAllowed } = require("../services/accessControl");

const router = express.Router();

router.get("/", authenticate, requireRole("OPERATOR", "ADMIN"), async (req, res) => {
  try {
    const permissionMap = await getPermissionMap();
    const allowed = Object.fromEntries(
      Object.entries(permissionMap).map(([key, level]) => [
        key,
        roleAllowed(req.user.role, level)
      ])
    );

    res.json({
      role: req.user.role,
      permissions: permissionMap,
      allowed
    });
  } catch (error) {
    console.error("Access map load failed:", error);
    res.status(500).json({ error: "Unable to load access permissions" });
  }
});

module.exports = router;
