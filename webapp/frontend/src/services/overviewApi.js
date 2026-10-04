import { apiRequest } from "./apiClient";

const SENSOR_ONLINE_THRESHOLD_MS = 60 * 1000;

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sensorDisplay(sensor) {
  if (!sensor) return null;

  const unit = sensor.unit || "";
  const value = sensor.value == null
    ? "—"
    : `${sensor.value}${unit ? ` ${unit}` : ""}`;

  let status = "Normal";
  let tone = "green";
  const recordedAt = new Date(sensor.recorded_at).getTime();

  if (sensor.status !== "ACTIVE") {
    status = "Disabled";
    tone = "neutral";
  } else if (!sensor.recorded_at || !Number.isFinite(recordedAt)) {
    status = "Unavailable";
    tone = "neutral";
  } else if (Date.now() - recordedAt > SENSOR_ONLINE_THRESHOLD_MS) {
    status = "Offline";
    tone = "red";
  } else if (sensor.quality_status && sensor.quality_status !== "VALID") {
    status = sensor.quality_status;
    tone = "orange";
  }

  return {
    value,
    status,
    tone,
    trend: [],
    percentage:
      sensor.sensor_type === "water_level" && Number.isFinite(Number(sensor.value))
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
    area: item.level_no === 0 ? "Global" : `Level ${item.level_no}`,
    time: formatTime(item.created_at)
  };
}

function mapApproval(item) {
  return {
    id: item.approval_id,
    action: item.action_type,
    label: item.action_data?.task_name || String(item.action_type || "Approval").replaceAll("_", " "),
    status: item.status,
    time: formatTime(item.reviewed_at || item.requested_at)
  };
}

function mapExecution(item) {
  return {
    ...item,
    time: formatTime(item.completed_at || item.started_at || item.created_at || item.scheduled_for)
  };
}

export async function getOverviewData(token, onTokenRefresh) {
  const [
    stateResult,
    sensorResult,
    recommendationResult,
    approvalResult,
    executionResult,
    executionSummaryResult
  ] = await Promise.allSettled([
    apiRequest("/api/farm/state", token, onTokenRefresh),
    apiRequest("/api/farm/sensors", token, onTokenRefresh),
    apiRequest("/api/ai/recommendations?limit=6&offset=0", token, onTokenRefresh),
    apiRequest("/api/approvals?limit=6&offset=0", token, onTokenRefresh),
    apiRequest("/api/task-executions?limit=6&offset=0", token, onTokenRefresh),
    apiRequest("/api/task-executions/summary?hours=24", token, onTokenRefresh)
  ]);

  if (stateResult.status === "rejected" && sensorResult.status === "rejected") {
    throw new Error("Unable to load overview data.");
  }

  const farm = stateResult.status === "fulfilled" ? stateResult.value.farm || {} : {};
  const sensors = sensorResult.status === "fulfilled" && Array.isArray(sensorResult.value.sensors)
    ? sensorResult.value.sensors
    : [];
  const recommendations = recommendationResult.status === "fulfilled" && Array.isArray(recommendationResult.value.recommendations)
    ? recommendationResult.value.recommendations
    : [];
  const approvals = approvalResult.status === "fulfilled" && Array.isArray(approvalResult.value.approvals)
    ? approvalResult.value.approvals
    : [];
  const executions = executionResult.status === "fulfilled" && Array.isArray(executionResult.value.executions)
    ? executionResult.value.executions
    : [];
  const executionSummary = executionSummaryResult.status === "fulfilled"
    ? executionSummaryResult.value.summary || {}
    : {};

  const sensorByType = Object.fromEntries(
    sensors.map((sensor) => [sensor.sensor_type, sensor])
  );

  return {
    summary: {
      farmHealth: {
        value: farm.emergency_stop ? "Stopped" : farm.critical_notifications > 0 ? "Attention" : "Online",
        note: `${farm.active_sensors ?? 0}/${farm.sensors ?? 0} sensors online`
      },
      activeCameras: {
        value: farm.active_cameras ?? 0,
        note: `${farm.active_cameras ?? 0}/${farm.cameras ?? 0} cameras active`
      },
      alerts: {
        value: farm.open_notifications ?? 0,
        note: "Open notifications"
      },
      pending: {
        value: approvals.filter((item) => item.status === "PENDING").length,
        note: "Recent pending approvals"
      },
      taskRuns: {
        value: executionSummary.total ?? 0,
        note: `${executionSummary.completed ?? 0} completed · ${executionSummary.failed ?? 0} failed`
      },
      approved: {
        value: approvals.filter((item) => item.status === "APPROVED").length,
        note: "Recent approved requests"
      }
    },
    sensors: {
      ph: sensorDisplay(sensorByType.ph),
      ec: sensorDisplay(sensorByType.ec),
      ambientTemperature: sensorDisplay(sensorByType.ambient_temperature),
      waterTemperature: sensorDisplay(sensorByType.water_temperature),
      humidity: sensorDisplay(sensorByType.humidity),
      dewPoint: sensorDisplay(sensorByType.dew_point),
      waterLevel: sensorDisplay(sensorByType.water_level)
    },
    recommendations: recommendations
      .filter((item) => item.status === "PENDING")
      .map(mapRecommendation),
    recentApprovals: approvals.map(mapApproval),
    recentExecutions: executions.map(mapExecution),
    errors: {
      approvals: approvalResult.status === "rejected",
      executions: executionResult.status === "rejected"
    }
  };
}

export function mergeOverviewSensorSnapshot(data, payload) {
  if (!data?.sensors || !payload?.sensors) return data;

  const keyByType = {
    ph: "ph",
    ec: "ec",
    ambient_temperature: "ambientTemperature",
    water_temperature: "waterTemperature",
    humidity: "humidity",
    dew_point: "dewPoint",
    water_level: "waterLevel"
  };

  const sensors = { ...data.sensors };

  Object.entries(payload.sensors).forEach(([type, reading]) => {
    const key = keyByType[type];
    if (!key) return;

    const unit = reading?.unit || "";
    const number = Number(reading?.value);

    sensors[key] = {
      ...(sensors[key] || {}),
      value: reading?.value == null ? "—" : `${reading.value}${unit ? ` ${unit}` : ""}`,
      status: reading?.quality_status === "VALID" ? "Normal" : reading?.quality_status || "Unavailable",
      tone: reading?.quality_status === "VALID" ? "green" : "orange",
      percentage:
        type === "water_level" && Number.isFinite(number)
          ? number
          : sensors[key]?.percentage
    };
  });

  return { ...data, sensors };
}
