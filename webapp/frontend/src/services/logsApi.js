import { apiRequest } from "./apiClient";

function titleCase(value) {
  return String(value || "System")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferLevel(log) {
  const metadata = log.metadata || {};

  if (metadata.level_no === 0) return "Global";
  if (metadata.level_no != null) return `Level ${metadata.level_no}`;

  return "Global";
}

function inferStatus(log) {
  const value = String(
    log.metadata?.status || log.action_type || ""
  ).toUpperCase();

  if (value.includes("FAIL") || value.includes("ERROR")) {
    return "Warning";
  }

  if (value.includes("PENDING")) {
    return "Pending";
  }

  if (value.includes("APPROV") || value.includes("COMPLETE")) {
    return "Approved";
  }

  return "Recorded";
}

function mapLog(log) {
  const date = new Date(log.created_at);
  const validDate = !Number.isNaN(date.getTime());
  const metadata = log.metadata || {};

  return {
    id: log.log_id,
    time: validDate
      ? date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      : "—",
    date: validDate
      ? date.toLocaleDateString("en-AU")
      : "—",
    actor: log.user_id ? `User ${log.user_id}` : "System",
    level: inferLevel(log),
    type: titleCase(log.entity_type || "SYSTEM"),
    event: titleCase(log.action_type),
    status: inferStatus(log),
    description: log.description || "No description available.",
    details: {
      requested: metadata.requested ?? "—",
      targetEC:
        metadata.target_ec ?? metadata.target_value ?? "—",
      targetPH:
        metadata.target_ph ?? metadata.target_value ?? "—",
      scheduled:
        metadata.scheduled_for ?? metadata.start_time ?? "—",
      requestedBy:
        metadata.requested_by ?? log.user_id ?? "—",
      requestId:
        metadata.request_id ??
        metadata.approval_id ??
        metadata.execution_id ??
        "—"
    },
    context: {
      waterLevel: metadata.water_level ?? "—",
      currentEC: metadata.current_ec ?? "—",
      currentPH: metadata.current_ph ?? "—"
    },
    raw: log
  };
}

export async function getLogsData(token, onTokenRefresh, options = {}) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const data = await apiRequest(`/api/logs?limit=${limit}&offset=${offset}`, token, onTokenRefresh);
  return Array.isArray(data.logs) ? data.logs.map(mapLog) : [];
}
