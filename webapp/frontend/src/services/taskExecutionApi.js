import { apiRequest } from "./apiClient";

export async function getTaskExecutions(token, onTokenRefresh, options = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.scheduleId) params.set("schedule_id", options.scheduleId);
  if (options.taskAction) params.set("task_action", options.taskAction);
  params.set("limit", String(options.limit || 100));
  params.set("offset", String(options.offset || 0));
  const data = await apiRequest(`/api/task-executions?${params}`, token, onTokenRefresh);
  return Array.isArray(data.executions) ? data.executions : [];
}
