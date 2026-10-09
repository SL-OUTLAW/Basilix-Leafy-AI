import { apiRequest } from "./apiClient";

export function getEngineSettings(token, onTokenRefresh) {
  return apiRequest(
    "/api/settings",
    token,
    onTokenRefresh
  );
}

export function reloadEngineSettings(token, onTokenRefresh) {
  return apiRequest(
    "/api/settings/reload",
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );
}

export function updateEngineSettings(
  token,
  onTokenRefresh,
  settings
) {
  return apiRequest(
    "/api/settings",
    token,
    onTokenRefresh,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ settings })
    }
  );
}

export function resetEngineSettings(token, onTokenRefresh, settingKey = null) {
  return apiRequest("/api/settings/reset", token, onTokenRefresh, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setting_key: settingKey })
  });
}

export function addCamera(token, onTokenRefresh, camera) {
  return apiRequest("/api/farm/cameras", token, onTokenRefresh, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(camera)
  });
}

export function getCameras(token, onTokenRefresh) {
  return apiRequest("/api/farm/cameras", token, onTokenRefresh);
}
