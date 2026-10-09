import { apiRequest } from "./apiClient";
import { refreshSession } from "./authApi";

const SENSOR_ONLINE_THRESHOLD_MS = 60 * 1000;
const LIVE_CHART_WINDOW_MS = 30 * 60 * 1000;

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

function mapRawReadings(response) {
  const readings = Array.isArray(response?.readings)
    ? response.readings
    : [];

  return readings
    .map((item) => ({
      time: item?.time,
      value: Number(item?.value),
      qualityStatus: item?.quality_status
    }))
    .filter(
      (item) =>
        item.time &&
        Number.isFinite(new Date(item.time).getTime()) &&
        Number.isFinite(item.value)
    );
}

function sensorDecimals(sensorType) {
  if (sensorType === "ph") return 3;
  if (sensorType === "ec") return 1;
  if (sensorType === "humidity") return 1;
  return 2;
}

function formatSensorUnit(unit) {
  const normalized = String(unit || "").trim();

  const units = {
    degC: "°C",
    degF: "°F",
    "uS/cm": "µS/cm",
    "uS_cm": "µS/cm"
  };

  return units[normalized] || normalized;
}

function formatSensorValue(sensorType, value, unit) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const formatted = numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: sensorDecimals(sensorType)
  });

  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function mapSensor(sensor, readingsResponse) {
  if (!sensor) {
    return null;
  }

  const value = sensor.value;
  const unit = formatSensorUnit(sensor.unit);
  const numericValue = Number(value);
  const history = mapRawReadings(readingsResponse);

  return {
    id: sensor.sensor_id,
    type: sensor.sensor_type,
    value: formatSensorValue(sensor.sensor_type, value, unit),
    rawValue: Number.isFinite(numericValue)
      ? numericValue
      : null,
    unit,
    status: formatSensorStatus(sensor),
    online: formatSensorStatus(sensor) === "Normal",
    qualityStatus: sensor.quality_status,
    recordedAt: sensor.recorded_at,
    history,
    trend: history.map((item) => item.value),
    percentage:
      sensor.sensor_type === "water_level" && Number.isFinite(numericValue)
        ? numericValue
        : undefined
  };
}

export async function getSensorReadings(
  token,
  onTokenRefresh,
  sensorType,
  startTime,
  endTime
) {
  const params = new URLSearchParams({
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString()
  });

  return apiRequest(
    `/api/farm/sensors/${encodeURIComponent(sensorType)}/readings?${params.toString()}`,
    token,
    onTokenRefresh
  );
}

function appendLiveReading(history, value, recordedAt) {
  const numericValue = Number(value);
  const timestamp = new Date(recordedAt).getTime();

  if (!Number.isFinite(numericValue) || !Number.isFinite(timestamp)) {
    return Array.isArray(history) ? history : [];
  }

  const current = Array.isArray(history) ? history : [];
  const nextPoint = {
    time: new Date(timestamp).toISOString(),
    value: numericValue,
    qualityStatus: "VALID"
  };

  const withoutDuplicate = current.filter(
    (item) => new Date(item?.time).getTime() !== timestamp
  );

  const cutoff = timestamp - LIVE_CHART_WINDOW_MS;

  return [...withoutDuplicate, nextPoint]
    .filter((item) => new Date(item?.time).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(a.time).getTime() - new Date(b.time).getTime()
    );
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

  const initialEnd = new Date();
  const initialStart = new Date(
    initialEnd.getTime() - LIVE_CHART_WINDOW_MS
  );

  const readingRequests = HISTORY_TYPES.map((sensorType) =>
    getSensorReadings(
      token,
      onTokenRefresh,
      sensorType,
      initialStart,
      initialEnd
    )
  );

  const [
    sensorsResult,
    camerasResult,
    activeCycleResult,
    harvestResult,
    controlsResult,
    analysisResult,
    ...readingResults
  ] = await Promise.allSettled([
    ...baseRequests,
    ...readingRequests
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

  const readings = {};

  HISTORY_TYPES.forEach((sensorType, index) => {
    const result = readingResults[index];

    readings[sensorType] =
      result?.status === "fulfilled"
        ? result.value
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
        ph: mapSensor(sensorByType.ph, readings.ph),
        ec: mapSensor(sensorByType.ec, readings.ec),
        temperature: mapSensor(
          sensorByType.ambient_temperature,
          readings.ambient_temperature
        ),
        waterTemperature: mapSensor(
          sensorByType.water_temperature,
          readings.water_temperature
        ),
        humidity: mapSensor(sensorByType.humidity, readings.humidity),
        dewPoint: mapSensor(sensorByType.dew_point, readings.dew_point),
        waterLevel: mapSensor(
          sensorByType.water_level,
          readings.water_level
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
  if (!data?.monitoring?.sensors || !payload?.sensors) {
    return data;
  }

  const keyByType = {
    ph: "ph",
    ec: "ec",
    water_temperature: "waterTemperature",
    ambient_temperature: "temperature",
    humidity: "humidity",
    dew_point: "dewPoint",
    water_level: "waterLevel"
  };

  const sensors = { ...data.monitoring.sensors };
  const recordedAt = payload.recorded_at || new Date().toISOString();

  Object.entries(payload.sensors).forEach(([type, reading]) => {
    const key = keyByType[type];

    if (!key) {
      return;
    }

    const current = sensors[key] || {};
    const number = Number(reading?.value);
    const unit = formatSensorUnit(
      reading?.unit || current.unit
    );
    const valid =
      reading?.value != null &&
      reading?.quality_status === "VALID";
    const history = valid
      ? appendLiveReading(current.history, number, recordedAt)
      : Array.isArray(current.history)
        ? current.history
        : [];

    sensors[key] = {
      ...current,
      value: formatSensorValue(type, reading?.value, unit),
      rawValue: Number.isFinite(number) ? number : null,
      unit,
      status: valid
        ? "Normal"
        : reading?.quality_status || "Unavailable",
      online: valid,
      qualityStatus: reading?.quality_status,
      recordedAt,
      history,
      trend: history.map((item) => item.value),
      percentage:
        type === "water_level" && Number.isFinite(number)
          ? number
          : current.percentage
    };
  });

  return {
    ...data,
    monitoring: {
      ...data.monitoring,
      sensors
    }
  };
}

