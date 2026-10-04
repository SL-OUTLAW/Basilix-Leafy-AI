import { apiRequest } from "./apiClient";

const SENSOR_ONLINE_THRESHOLD_MS = 60 * 1000;

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
    if (sensor.level_no === 1 || sensor.level_no === 2) {
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
    `${farm.active_sensors ?? 0}/${totalSensors} sensors online · ` +
    `${farm.active_cameras ?? 0}/${totalCameras} cameras active`
  );
}

function sensorDisplay(sensor) {
  if (!sensor) {
    return null;
  }

  const unit = sensor.unit || "";
  const value =
    sensor.value === null || sensor.value === undefined
      ? "—"
      : `${sensor.value}${unit ? ` ${unit}` : ""}`;

  let status = "Normal";
  let tone = "green";

  if (sensor.status !== "ACTIVE") {
    status = "Disabled";
    tone = "neutral";
  } else if (!sensor.recorded_at) {
    status = "Unavailable";
    tone = "neutral";
  } else if (Date.now() - new Date(sensor.recorded_at).getTime() > SENSOR_ONLINE_THRESHOLD_MS) {
    status = "Offline";
    tone = "red";
  } else if (
    sensor.quality_status &&
    sensor.quality_status !== "VALID"
  ) {
    status = sensor.quality_status;
    tone = "orange";
  }

  return {
    value,
    status,
    tone,
    trend: [],
    percentage:
      sensor.sensor_type === "water_level" &&
      Number.isFinite(Number(sensor.value))
        ? Number(sensor.value)
        : undefined
  };
}

function mapRecommendation(item) {
  return {
    id: item.recommendation_id,
    title: item.recommendation_message,
    description: item.recommendation_reason,
    status: item.status,
    risk: item.risk_level,
    area:
      item.level_no === 0
        ? "Global"
        : `Level ${item.level_no}`,
    time: formatTime(item.created_at),
    relativeTime: formatRelativeTime(item.created_at)
  };
}

export async function getOverviewData(
  token,
  onTokenRefresh
) {
  const [
    stateResult,
    sensorResult,
    cameraResult,
    notificationResult,
    recommendationResult,
    approvalResult
  ] = await Promise.allSettled([
    apiRequest("/api/farm/state", token, onTokenRefresh),
    apiRequest("/api/farm/sensors", token, onTokenRefresh),
    apiRequest("/api/farm/cameras", token, onTokenRefresh),
    apiRequest("/api/notifications", token, onTokenRefresh),
    apiRequest(
      "/api/ai/recommendations?limit=20",
      token,
      onTokenRefresh
    ),
    apiRequest(
      "/api/approvals?limit=100",
      token,
      onTokenRefresh
    )
  ]);

  const primary = [
    stateResult,
    sensorResult,
    cameraResult,
    notificationResult
  ];

  if (primary.every((result) => result.status === "rejected")) {
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

  const recommendations =
    recommendationResult.status === "fulfilled" &&
    Array.isArray(recommendationResult.value.recommendations)
      ? recommendationResult.value.recommendations
      : [];

  const approvals =
    approvalResult.status === "fulfilled" &&
    Array.isArray(approvalResult.value.approvals)
      ? approvalResult.value.approvals
      : [];

  const recentNotifications = notifications.filter((item) =>
    isRecent(item.created_at)
  );

  const alertCount = recentNotifications.filter((item) =>
    ["WARN", "CRITICAL"].includes(item.severity)
  ).length;

  const approved = approvals.filter(
    (item) => item.status === "APPROVED"
  ).length;

  const sensorByType = Object.fromEntries(
    sensors.map((sensor) => [sensor.sensor_type, sensor])
  );

  const healthValue = stateFailed
    ? null
    : farm.emergency_stop
      ? "Stopped"
      : farm.critical_notifications > 0
        ? "Attention"
        : "Online";

  return {
    summary: {
      farmHealth: {
        value: healthValue,
        note: stateFailed
          ? "Farm status unavailable"
          : getFarmHealthNote(farm)
      },

      activeSensors: {
        value: farm.active_sensors ?? 0,
        note: `${farm.active_sensors ?? 0}/${farm.sensors ?? 0} sensors online`
      },

      alerts: {
        value: notificationsFailed ? null : alertCount,
        note: notificationsFailed
          ? "Unavailable"
          : "Last 24 hours"
      },

      pending: {
        value:
          approvalResult.status === "fulfilled"
            ? approvals.filter((item) => item.status === "PENDING").length
            : null,
        note: "Pending approvals"
      },

      autoExecuted: {
        value:
          null,
        note: "Execution mode not exposed"
      },

      approved: {
        value:
          approvalResult.status === "fulfilled"
            ? approved
            : null,
        note: "Approved requests"
      }
    },

    sensors: {
      ph: sensorDisplay(sensorByType.ph),
      temperature: sensorDisplay(sensorByType.ambient_temperature),
      waterLevel: sensorDisplay(sensorByType.water_level),
      ec: sensorDisplay(sensorByType.ec)
    },

    farmOverview: {
      levels: buildLevels(sensors, cameras)
    },

    recommendations: recommendations
      .slice(0, 6)
      .map(mapRecommendation),

    notifications: recentNotifications.map((item) => ({
      id: item.notification_id,
      type: item.notification_type,
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

export function mergeOverviewSensorSnapshot(data, payload) {
  if (!data?.sensors || !payload?.sensors) return data;
  const keyByType = { ph: "ph", ec: "ec", ambient_temperature: "temperature", water_level: "waterLevel" };
  const sensors = { ...data.sensors };
  Object.entries(payload.sensors).forEach(([type, reading]) => {
    const key = keyByType[type]; if (!key) return;
    const unit = reading?.unit || ""; const number = Number(reading?.value);
    sensors[key] = { ...(sensors[key] || {}), value: reading?.value == null ? "—" : `${reading.value}${unit ? ` ${unit}` : ""}`, status: reading?.quality_status === "VALID" ? "Normal" : reading?.quality_status || "Unavailable", tone: reading?.quality_status === "VALID" ? "green" : "orange", percentage: type === "water_level" && Number.isFinite(number) ? number : sensors[key]?.percentage };
  });
  return { ...data, sensors };
}
