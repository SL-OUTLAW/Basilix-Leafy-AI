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
