const express = require("express");

const { backendQuery } = require("../services/backendDatabase");

const router = express.Router();

router.get("/farm", async (req, res) => {
  try {
    const result = await backendQuery(`
      SELECT
        type,
        severity,
        created_at
      FROM notifications
      WHERE type IN (
        'SENSOR_ALERT',
        'SENSOR_OFFLINE',
        'CAMERA_ALERT',
        'CAMERA_OFFLINE'
      )
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    res.json({
      latestAlert: result.rows[0] || null
    });
  } catch (error) {
    console.error("Public farm monitoring request failed:", error);

    res.status(500).json({
      error: "Failed to load farm monitoring information"
    });
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const result = await backendQuery(`
      SELECT
        type,
        severity,
        created_at
      FROM notifications
      WHERE type IN (
        'SENSOR_ALERT',
        'SENSOR_OFFLINE',
        'CAMERA_ALERT',
        'CAMERA_OFFLINE'
      )
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    res.json({
      alerts: result.rows
    });
  } catch (error) {
    console.error("Public alerts request failed:", error);

    res.status(500).json({
      error: "Failed to load alerts"
    });
  }
});

module.exports = router;
