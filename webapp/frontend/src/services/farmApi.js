import { apiRequest } from "./apiClient";
import { refreshSession } from "./authApi";

const SENSOR_ONLINE_THRESHOLD_MS = 60 * 1000;

const HISTORY_TYPES = [
  "ph",
  "ec",
  "water_temperature",
  "ambient_temperature",
  "humidity",
  "dew_point",
  "water_level"
];

function formatSensorStatus(sensor) {
  if (!sensor) {
    return "Not available";
  }

  if (sensor.status !== "ACTIVE") {
    return "Inactive";
  }

  if (!sensor.recorded_at) {
    return "No reading";
  }

  const recordedAt = new Date(sensor.recorded_at).getTime();
  if (!Number.isFinite(recordedAt) || Date.now() - recordedAt > SENSOR_ONLINE_THRESHOLD_MS) {
    return "Offline";
  }

  if (sensor.quality_status && sensor.quality_status !== "VALID") {
    return sensor.quality_status;
  }

  return "Normal";
}

function mapHistory(history) {
  const timeline = Array.isArray(history?.timeline)
    ? history.timeline
    : [];

  return timeline
    .filter((item) => Number.isFinite(Number(item.mean)))
    .map((item) => ({
      time: item.time,
      value: Number(item.mean),
      min: item.min,
      max: item.max,
      samples: item.samples
    }));
}

function mapSensor(sensor, history) {
  if (!sensor) {
    return null;
  }

  const value = sensor.value;
  const unit = sensor.unit || "";
  const numericValue = Number(value);

  return {
    id: sensor.sensor_id,
    type: sensor.sensor_type,
    value:
      value === null || value === undefined
        ? null
        : `${value}${unit ? ` ${unit}` : ""}`,
    rawValue: Number.isFinite(numericValue)
      ? numericValue
      : null,
    unit,
    status: formatSensorStatus(sensor),
    online: formatSensorStatus(sensor) === "Normal",
    qualityStatus: sensor.quality_status,
    recordedAt: sensor.recorded_at,
    history: mapHistory(history),
    trend: mapHistory(history).map((item) => item.value),
    percentage:
      sensor.sensor_type === "water_level" && Number.isFinite(numericValue)
        ? numericValue
        : undefined
  };
}

function buildLevels(cameras) {
  return cameras.map((camera) => ({
    id: String(camera.level_no),
    name: `Level ${camera.level_no}`,
    camera: {
      id: camera.camera_id,
      name: camera.camera_name,
      status: String(camera.status || "").toLowerCase()
    }
  }));
}

function buildHarvest(historyResponse, activeCycle) {
  const cycles = Array.isArray(historyResponse?.grow_cycles)
    ? historyResponse.grow_cycles
    : [];

  const latest = cycles[0] || null;
  const latestSummary = latest?.harvest_summary || null;

  if (activeCycle) {
    return {
      predictedValue: "—",
      label: "Current Grow Cycle",
      trackerTitle: activeCycle.cycle_name || "Active Grow Cycle",
      trackerText: `Started ${new Date(activeCycle.started_at).toLocaleDateString()}. Harvest prediction is not supplied by the Engine.`
    };
  }

  if (latestSummary) {
    return {
      predictedValue: `${Math.round(latestSummary.total_harvest_weight_g || 0)} g`,
      label: "Latest Harvest",
      trackerTitle: latest.cycle_name || "Harvest History",
      trackerText: `${latestSummary.harvest_count || 0} harvest record(s) from the latest completed grow cycle.`
    };
  }

  return null;
}

export async function getFarmData(
  token,
  onTokenRefresh
) {
  const baseRequests = [
    apiRequest("/api/farm/sensors", token, onTokenRefresh),
    apiRequest("/api/farm/cameras", token, onTokenRefresh),
    apiRequest("/api/grow-cycles/active", token, onTokenRefresh),
    apiRequest("/api/harvest/history?limit=5&include_active=true", token, onTokenRefresh),
    apiRequest("/api/farm/controls", token, onTokenRefresh),
    apiRequest("/api/task-executions?task_action=RUN_AI_ANALYSIS&limit=10&offset=0", token, onTokenRefresh)
  ];

  const historyRequests = HISTORY_TYPES.map((sensorType) =>
    apiRequest(
      `/api/farm/sensors/${sensorType}/history?time_range=24h`,
      token,
      onTokenRefresh
    )
  );

  const [
    sensorsResult,
    camerasResult,
    activeCycleResult,
    harvestResult,
    controlsResult,
    analysisResult,
    ...historyResults
  ] = await Promise.allSettled([
    ...baseRequests,
    ...historyRequests
  ]);

  if (
    sensorsResult.status === "rejected" &&
    camerasResult.status === "rejected"
  ) {
    throw new Error("Unable to load farm monitoring data.");
  }

  const sensors =
    sensorsResult.status === "fulfilled" &&
    Array.isArray(sensorsResult.value.sensors)
      ? sensorsResult.value.sensors
      : [];

  const cameras =
    camerasResult.status === "fulfilled" &&
    Array.isArray(camerasResult.value.cameras)
      ? camerasResult.value.cameras
      : [];

  const histories = {};

  HISTORY_TYPES.forEach((sensorType, index) => {
    const result = historyResults[index];

    histories[sensorType] =
      result?.status === "fulfilled"
        ? result.value.history
        : null;
  });

  const sensorByType = Object.fromEntries(
    sensors.map((sensor) => [sensor.sensor_type, sensor])
  );

  const activeCycle =
    activeCycleResult.status === "fulfilled"
      ? activeCycleResult.value.grow_cycle
      : null;

  const harvestHistory =
    harvestResult.status === "fulfilled"
      ? harvestResult.value.history
      : null;

  const analyses =
    analysisResult.status === "fulfilled" && Array.isArray(analysisResult.value.executions)
      ? analysisResult.value.executions
      : [];

  const controls =
    controlsResult.status === "fulfilled"
      ? controlsResult.value.controls || {}
      : {};

  return {
    monitoring: {
      sensors: {
        ph: mapSensor(sensorByType.ph, histories.ph),
        ec: mapSensor(sensorByType.ec, histories.ec),
        temperature: mapSensor(
          sensorByType.ambient_temperature,
          histories.ambient_temperature
        ),
        waterTemperature: mapSensor(
          sensorByType.water_temperature,
          histories.water_temperature
        ),
        humidity: mapSensor(sensorByType.humidity, histories.humidity),
        dewPoint: mapSensor(sensorByType.dew_point, histories.dew_point),
        waterLevel: mapSensor(
          sensorByType.water_level,
          histories.water_level
        )
      },
      camera: cameras[0]
        ? {
            status: String(cameras[0].status || "").toLowerCase()
          }
        : null,
      cameras,
      levels: buildLevels(cameras),
      harvest: buildHarvest(harvestHistory, activeCycle)
    },
    insight: {
      analyses
    },
    routine: {
      activeCycle,
      history: harvestHistory
    },
    controls
  };
}

export async function getCameraImageBlob(
  cameraId,
  token,
  onTokenRefresh
) {
  let activeToken = token;
  let response = await fetch(`/api/farm/cameras/${cameraId}/image`, {
    headers: { Authorization: `Bearer ${activeToken}` }
  });

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed?.token) throw new Error("Session refresh failed");
    activeToken = refreshed.token;
    onTokenRefresh?.(activeToken);
    response = await fetch(`/api/farm/cameras/${cameraId}/image`, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
  }

  if (!response.ok) throw new Error("Latest camera image unavailable");
  return response.blob();
}

export function setLighting(token, onTokenRefresh, levelNo, enabled) {
  return apiRequest(
    "/api/farm/controls/lighting",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        level_no: levelNo,
        enabled
      })
    }
  );
}

export function setIrrigation(token, onTokenRefresh, enabled) {
  return apiRequest(
    "/api/farm/controls/irrigation",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enabled })
    }
  );
}

export function setFan(token, onTokenRefresh, enabled) {
  return apiRequest(
    "/api/farm/controls/fan",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enabled })
    }
  );
}

export function setPhTarget(token, onTokenRefresh, targetValue) {
  return apiRequest(
    "/api/farm/controls/ph/target",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target_value: Number(targetValue)
      })
    }
  );
}

export function setEcTarget(token, onTokenRefresh, targetValue) {
  return apiRequest(
    "/api/farm/controls/ec/target",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target_value: Number(targetValue)
      })
    }
  );
}

export function mergeFarmSensorSnapshot(data, payload) {
  if (!data?.monitoring?.sensors || !payload?.sensors) return data;
  const keyByType = { ph: "ph", ec: "ec", water_temperature: "waterTemperature", ambient_temperature: "temperature", humidity: "humidity", dew_point: "dewPoint", water_level: "waterLevel" };
  const sensors = { ...data.monitoring.sensors };
  Object.entries(payload.sensors).forEach(([type, reading]) => {
    const key = keyByType[type]; if (!key) return;
    const current = sensors[key] || {};
    const number = Number(reading?.value); const unit = reading?.unit || current.unit || "";
    sensors[key] = { ...current, value: reading?.value == null ? null : `${reading.value}${unit ? ` ${unit}` : ""}`, rawValue: Number.isFinite(number) ? number : null, unit, status: reading?.quality_status === "VALID" ? "Normal" : reading?.quality_status || "Unavailable", online: reading?.value != null && reading?.quality_status === "VALID", qualityStatus: reading?.quality_status, recordedAt: payload.recorded_at || current.recordedAt, percentage: type === "water_level" && Number.isFinite(number) ? number : current.percentage };
  });
  return { ...data, monitoring: { ...data.monitoring, sensors } };
}
