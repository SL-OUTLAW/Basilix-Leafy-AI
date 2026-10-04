import { apiRequest } from "./apiClient";

export async function getTaskExecutions(token, onTokenRefresh, options = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.scheduleId) params.set("schedule_id", options.scheduleId);
  params.set("limit", String(options.limit || 100));
  params.set("offset", String(options.offset || 0));
  const data = await apiRequest(`/api/task-executions?${params}`, token, onTokenRefresh);
  return Array.isArray(data.executions) ? data.executions : [];
}
