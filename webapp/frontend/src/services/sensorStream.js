import { refreshSession } from "./authApi";

async function openStream(token, signal) {
  return fetch("/api/farm/sensors/stream", { headers: { Authorization: `Bearer ${token}` }, signal });
}

export async function streamSensors(token, onTokenRefresh, onSensors, signal) {
  let activeToken = token;
  while (!signal?.aborted) {
    let response = await openStream(activeToken, signal);
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (!refreshed?.token) throw new Error("Session refresh failed");
      activeToken = refreshed.token; onTokenRefresh?.(activeToken);
      response = await openStream(activeToken, signal);
    }
    if (!response.ok || !response.body) throw new Error("Unable to connect to live sensor stream");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    try {
      while (!signal?.aborted) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() || "";
        for (const event of events) {
          const lines = event.split("\n");
          const eventType = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
          const data = lines.find((line) => line.startsWith("data:"))?.slice(5).trim();
          if (eventType === "sensors" && data) onSensors(JSON.parse(data));
        }
      }
    } finally { reader.releaseLock(); }
    if (!signal?.aborted) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
