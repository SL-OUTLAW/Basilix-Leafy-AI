import { apiRequest } from "./apiClient";

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function relativeTime(value) {
  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) {
    return "";
  }

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - time) / 60000)
  );

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function prettyAction(value) {
  return String(value || "Action")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapApproval(item) {
  return {
    id: item.approval_id,
    type: item.action_type,
    command: prettyAction(item.action_type),
    description:
      item.action_data?.description ||
      item.action_data?.task_name ||
      "Human approval is required before this action can continue.",
    risk: item.risk_level
      ? `${item.risk_level[0]}${item.risk_level.slice(1).toLowerCase()} Risk`
      : "Unknown",
    status: item.status,
    time: formatTime(item.requested_at),
    relativeTime: relativeTime(item.requested_at),
    actionData: item.action_data
  };
}

function mapRiskConfiguration(configuration) {
  const risk = configuration?.risk || {};

  return Object.entries(risk).map(([action, level]) => ({
    id: action,
    type: action,
    command: prettyAction(action),
    description: "Configured action risk classification.",
    risk: `${String(level).slice(0, 1)}${String(level).slice(1).toLowerCase()} Risk`,
    approvalText:
      String(level).toUpperCase() === "HIGH"
        ? "Human approval required"
        : "Eligible for automatic handling"
  }));
}

function mapExecution(item) {
  return {
    id: item.execution_id,
    type: item.status,
    command: `Task execution #${item.execution_id}`,
    description:
      item.error_message ||
      `Schedule #${item.schedule_id} ${String(item.status || "").toLowerCase()}.`,
    time: formatTime(
      item.completed_at || item.started_at || item.created_at
    ),
    relativeTime: relativeTime(
      item.completed_at || item.started_at || item.created_at
    )
  };
}

export async function getSafetyData(
  token,
  onTokenRefresh
) {
  const [state, configuration, approvals, executions] =
    await Promise.all([
      apiRequest("/api/safety", token, onTokenRefresh),
      apiRequest(
        "/api/safety/configuration",
        token,
        onTokenRefresh
      ),
      apiRequest(
        "/api/approvals?limit=100",
        token,
        onTokenRefresh
      ),
      apiRequest(
        "/api/task-executions?limit=100",
        token,
        onTokenRefresh
      )
    ]);

  const approvalItems = Array.isArray(approvals.approvals)
    ? approvals.approvals.map(mapApproval)
    : [];

  const executionItems = Array.isArray(executions.executions)
    ? executions.executions
    : [];

  const pending = approvalItems.filter(
    (item) => item.status === "PENDING"
  );

  const blocked = executionItems.filter((item) =>
    ["BLOCKED", "FAILED", "SKIPPED"].includes(item.status)
  ).length;

  const mappedConfiguration = mapRiskConfiguration(
    configuration.configuration
  );

  return {
    state: state.safety || {},
    summary: {
      commands: executionItems.length,
      blocked,
      autoExecuted: null,
      pending: pending.length
    },
    pendingApprovals: pending.slice(0, 6),
    approvals: approvalItems,
    riskAssessment: mappedConfiguration,
    configuration: mappedConfiguration,
    recentActivity: executionItems.slice(0, 10).map(mapExecution)
  };
}

export function approveRequest(
  token,
  onTokenRefresh,
  approvalId,
  reviewNote = null
) {
  return apiRequest(
    `/api/approvals/${approvalId}/approve`,
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        review_note: reviewNote
      })
    }
  );
}

export function rejectRequest(
  token,
  onTokenRefresh,
  approvalId,
  reviewNote = null
) {
  return apiRequest(
    `/api/approvals/${approvalId}/reject`,
    token,
    onTokenRefresh,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        review_note: reviewNote
      })
    }
  );
}

export function activateEmergencyStop(token, onTokenRefresh) {
  return apiRequest(
    "/api/safety/emergency-stop",
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );
}

export function clearEmergencyStop(token, onTokenRefresh) {
  return apiRequest(
    "/api/safety/emergency-stop/clear",
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );
}

export function setAiEnabled(
  token,
  onTokenRefresh,
  enabled
) {
  return apiRequest(
    enabled
      ? "/api/safety/ai/enable"
      : "/api/safety/ai/disable",
    token,
    onTokenRefresh,
    {
      method: "POST"
    }
  );
}

export function getSafetyState(token, onTokenRefresh) {
  return apiRequest(
    "/api/safety",
    token,
    onTokenRefresh
  );
}
