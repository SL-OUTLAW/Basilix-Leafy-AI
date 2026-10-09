import { apiRequest } from "./apiClient";

export async function getFarmSchedule(
  token,
  onTokenRefresh
) {
  const data = await apiRequest(
    "/api/farm/schedule",
    token,
    onTokenRefresh
  );

  return Array.isArray(data.schedules)
    ? data.schedules
    : [];
}

export async function getSchedule(
  token,
  onTokenRefresh,
  scheduleId
) {
  const data = await apiRequest(
    `/api/farm/schedule/${scheduleId}`,
    token,
    onTokenRefresh
  );

  return data.schedule;
}

export async function createSchedule(
  token,
  onTokenRefresh,
  schedule
) {
  const data = await apiRequest(
    "/api/farm/schedule",
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(schedule)
    }
  );

  return data.schedule;
}

export async function updateSchedule(
  token,
  onTokenRefresh,
  scheduleId,
  updates
) {
  const data = await apiRequest(
    `/api/farm/schedule/${scheduleId}`,
    token,
    onTokenRefresh,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updates)
    }
  );

  return data.schedule;
}

export async function setScheduleEnabled(
  token,
  onTokenRefresh,
  scheduleId,
  enabled
) {
  const data = await apiRequest(
    `/api/farm/schedule/${scheduleId}/${enabled ? "enable" : "disable"}`,
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );

  return data.schedule;
}
