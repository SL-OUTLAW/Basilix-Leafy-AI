import { apiRequest } from "./apiClient";

export function getGrowCycles(token, onTokenRefresh) {
  return apiRequest(
    "/api/grow-cycles",
    token,
    onTokenRefresh
  );
}

export function getActiveGrowCycle(token, onTokenRefresh) {
  return apiRequest(
    "/api/grow-cycles/active",
    token,
    onTokenRefresh
  );
}

export function createGrowCycle(
  token,
  onTokenRefresh,
  cycle
) {
  return apiRequest(
    "/api/grow-cycles",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cycle)
    }
  );
}

export function completeGrowCycle(
  token,
  onTokenRefresh,
  growCycleId
) {
  return apiRequest(
    `/api/grow-cycles/${growCycleId}/complete`,
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );
}

export function cancelGrowCycle(
  token,
  onTokenRefresh,
  growCycleId
) {
  return apiRequest(
    `/api/grow-cycles/${growCycleId}/cancel`,
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );
}

export function recordHarvest(
  token,
  onTokenRefresh,
  growCycleId,
  harvest
) {
  return apiRequest(
    `/api/grow-cycles/${growCycleId}/harvests`,
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(harvest)
    }
  );
}

export function updateGrowCycle(token, onTokenRefresh, growCycleId, changes) {
  return apiRequest(`/api/grow-cycles/${growCycleId}`, token, onTokenRefresh, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
}

export function deleteGrowCycle(token, onTokenRefresh, growCycleId) {
  return apiRequest(`/api/grow-cycles/${growCycleId}`, token, onTokenRefresh, { method: "DELETE" });
}
