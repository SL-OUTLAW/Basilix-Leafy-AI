const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const {
  getUserNotifications,
  markNotificationAsRead
} = require("../services/notificationService");

const router = express.Router();

router.use(
  authenticate,
  requireRole("OPERATOR", "ADMIN")
);

router.get("/", async (req, res) => {
  try {
    const notifications = await getUserNotifications(
      req.user.userId
    );

    return res.json({
      notifications
    });
  } catch (error) {
    console.error("Notification inbox failed:", error);

    return res.status(500).json({
      error: "Failed to load notifications"
    });
  }
});

router.patch("/:id/read", async (req, res) => {
  const notificationId = Number(req.params.id);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({
      error: "Invalid notification ID"
    });
  }

  try {
    const notification = await markNotificationAsRead(
      notificationId,
      req.user.userId
    );

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found"
      });
    }

    return res.json({
      notification
    });
  } catch (error) {
    console.error("Mark notification as read failed:", error);

    return res.status(500).json({
      error: "Failed to update notification"
    });
  }
});

module.exports = router;