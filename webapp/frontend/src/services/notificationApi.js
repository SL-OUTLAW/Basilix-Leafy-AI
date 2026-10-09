import { apiRequest } from "./apiClient";
import { refreshSession } from "./authApi";

export function getNotifications(token, onTokenRefresh, { limit = 30, offset = 0 } = {}) {
  return apiRequest(`/api/notifications?limit=${limit}&offset=${offset}`, token, onTokenRefresh);
}

export function markNotificationRead(token, onTokenRefresh, notificationId) {
  return apiRequest(`/api/notifications/${notificationId}/read`, token, onTokenRefresh, { method: "POST" });
}

export function markAllNotificationsRead(token, onTokenRefresh) {
  return apiRequest("/api/notifications/read-all", token, onTokenRefresh, { method: "POST" });
}

async function openStream(token, after, signal) {
  return fetch(`/api/notifications/stream?after=${after || 0}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  });
}

export async function streamNotifications(token, onTokenRefresh, after, onNotification, signal) {
  let activeToken = token;
  let lastId = Number(after || 0);

  while (!signal?.aborted) {
    let response = await openStream(activeToken, lastId, signal);
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed?.token) throw new Error("Session refresh failed");
      activeToken = refreshed.token;
      onTokenRefresh?.(activeToken);
      response = await openStream(activeToken, lastId, signal);
    }
    if (!response.ok || !response.body) throw new Error("Unable to connect to notification stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!signal?.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const lines = event.split("\n");
          const type = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
          const raw = lines.find((line) => line.startsWith("data:"))?.slice(5).trim();
          if (type === "notification" && raw) {
            const item = JSON.parse(raw);
            lastId = Math.max(lastId, Number(item.notification_id || 0));
            onNotification(item);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    if (!signal?.aborted) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
