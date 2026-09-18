const express = require("express");

const { query } = require("../services/database");
const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");

const router = express.Router();

router.use(
  authenticate,
  requireRole("OPERATOR", "ADMIN")
);

router.get("/state", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM sensors) AS sensors,
        (
          SELECT COUNT(*)::int
          FROM sensors
          WHERE status = 'ACTIVE'
        ) AS active_sensors,
        (SELECT COUNT(*)::int FROM cameras) AS cameras,
        (
          SELECT COUNT(*)::int
          FROM cameras
          WHERE status = 'ACTIVE'
        ) AS active_cameras,
        (
          SELECT COUNT(*)::int
          FROM farm_schedule
          WHERE enabled = TRUE
        ) AS enabled_tasks;
    `);

    res.json({
      farm: result.rows[0]
    });
  } catch (error) {
    console.error("Farm state request failed:", error);

    res.status(500).json({
      error: "Failed to load farm state"
    });
  }
});

router.get("/sensors", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        sensor_id,
        sensor_name,
        sensor_type,
        level_no,
        sensor_no,
        unit,
        status
      FROM sensors
      ORDER BY level_no, sensor_type, sensor_no;
    `);

    res.json({
      sensors: result.rows
    });
  } catch (error) {
    console.error("Sensor information request failed:", error);

    res.status(500).json({
      error: "Failed to load sensor information"
    });
  }
});

router.get("/cameras", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        camera_id,
        camera_name,
        level_no,
        status
      FROM cameras
      ORDER BY level_no, camera_id;
    `);

    res.json({
      cameras: result.rows
    });
  } catch (error) {
    console.error("Camera information request failed:", error);

    res.status(500).json({
      error: "Failed to load camera information"
    });
  }
});

router.get("/schedule", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        schedule_id,
        task_name,
        description,
        task_action,
        level_no,
        start_time,
        duration_seconds,
        target_value,
        unit,
        last_run_at,
        next_run_at,
        enabled,
        status
      FROM farm_schedule
      ORDER BY start_time, level_no, schedule_id;
    `);

    res.json({
      schedule: result.rows
    });
  } catch (error) {
    console.error("Farm schedule request failed:", error);

    res.status(500).json({
      error: "Failed to load farm schedule"
    });
  }
});

module.exports = router;
