import { apiRequest } from "./apiClient";

function isRecent(dateValue) {
  const time = new Date(dateValue).getTime();

  return Number.isFinite(time) &&
    Date.now() - time <= 24 * 60 * 60 * 1000;
}

function formatTime(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatRelativeTime(dateValue) {
  const time = new Date(dateValue).getTime();

  if (!Number.isFinite(time)) {
    return "";
  }

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - time) / 60000)
  );

  if (minutes < 1) {
    return "Now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function buildLevels(sensors, cameras) {
  const levels = new Set();

  sensors.forEach((sensor) => {
    if (sensor.level_no != null) {
      levels.add(Number(sensor.level_no));
    }
  });

  cameras.forEach((camera) => {
    if (camera.level_no != null) {
      levels.add(Number(camera.level_no));
    }
  });

  return [...levels]
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map((level) => {
      const camera = cameras.find(
        (item) => Number(item.level_no) === level
      );

      return {
        id: String(level),
        name: `Level ${level}`,
        alertCount: null,
        camera: camera
          ? {
              id: camera.camera_id,
              name: camera.camera_name,
              status: camera.status
            }
          : null
      };
    });
}

function getFarmHealthNote(farm) {
  const totalSensors = farm.sensors ?? 0;
  const totalCameras = farm.cameras ?? 0;

  if (totalSensors === 0 && totalCameras === 0) {
    return "No sensors or cameras configured";
  }

  return (
    `${farm.active_sensors ?? 0}/${totalSensors} sensors active · ` +
    `${farm.active_cameras ?? 0}/${totalCameras} cameras active`
  );
}

export async function getOverviewData(
  token,
  onTokenRefresh
) {
  const [
    stateResult,
    sensorResult,
    cameraResult,
    notificationResult
  ] = await Promise.allSettled([
    apiRequest("/api/farm/state", token, onTokenRefresh),
    apiRequest("/api/farm/sensors", token, onTokenRefresh),
    apiRequest("/api/farm/cameras", token, onTokenRefresh),
    apiRequest("/api/notifications", token, onTokenRefresh)
  ]);

  const allFailed = [
    stateResult,
    sensorResult,
    cameraResult,
    notificationResult
  ].every((result) => result.status === "rejected");

  if (allFailed) {
    throw new Error("Unable to load overview data.");
  }

  const stateFailed = stateResult.status === "rejected";
  const sensorsFailed = sensorResult.status === "rejected";
  const camerasFailed = cameraResult.status === "rejected";
  const notificationsFailed =
    notificationResult.status === "rejected";

  const farm = stateFailed
    ? {}
    : stateResult.value.farm || {};

  const sensors = sensorsFailed
    ? []
    : Array.isArray(sensorResult.value.sensors)
      ? sensorResult.value.sensors
      : [];

  const cameras = camerasFailed
    ? []
    : Array.isArray(cameraResult.value.cameras)
      ? cameraResult.value.cameras
      : [];

  const notifications = notificationsFailed
    ? []
    : Array.isArray(notificationResult.value.notifications)
      ? notificationResult.value.notifications
      : [];

  const recentNotifications = notifications.filter((item) =>
    isRecent(item.created_at)
  );

  const alertTypes = new Set([
    "SENSOR_ALERT",
    "SENSOR_OFFLINE",
    "CAMERA_ALERT",
    "CAMERA_OFFLINE"
  ]);

  const alertCount = recentNotifications.filter((item) =>
    alertTypes.has(item.type)
  ).length;

  return {
    summary: {
      farmHealth: {
        value: null,
        note: stateFailed
          ? "Farm status unavailable"
          : getFarmHealthNote(farm)
      },

      activeSensors: {
        value: farm.active_sensors ?? 0,
        note: `${farm.active_sensors ?? 0}/${farm.sensors ?? 0} sensors active`
      },

      alerts: {
        value: notificationsFailed ? null : alertCount,
        note: notificationsFailed
          ? "Unavailable"
          : "Last 24 hours"
      },

      pending: {
        value: null,
        note: "Not available"
      },

      autoExecuted: {
        value: null,
        note: "Not available"
      },

      approved: {
        value: null,
        note: "Not available"
      }
    },

    sensors: {},

    farmOverview: {
      levels: buildLevels(sensors, cameras)
    },

    recommendations: [],

    notifications: recentNotifications.map((item) => ({
      id: item.notification_id,
      type: item.type,
      title: item.title,
      message: item.message,
      severity: item.severity,
      status: item.status,
      time: formatTime(item.created_at),
      relativeTime: formatRelativeTime(item.created_at)
    })),

    errors: {
      farmOverview: sensorsFailed && camerasFailed,
      notifications: notificationsFailed
    }
  };
}
