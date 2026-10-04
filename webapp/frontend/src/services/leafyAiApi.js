import { apiRequest } from "./apiClient";

function formatTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function mapRecommendation(item) {
  const evidence = Array.isArray(item.evidence)
    ? item.evidence.map(String)
    : item.evidence && typeof item.evidence === "object"
      ? Object.entries(item.evidence).map(
          ([key, value]) => `${key}: ${String(value)}`
        )
      : [];

  return {
    id: item.recommendation_id,
    time: formatTime(item.created_at),
    priority: item.risk_level
      ? `${item.risk_level} Risk`
      : "Unclassified",
    type: item.recommendation_type,
    title: item.recommendation_message || "Recommendation",
    summary: item.recommendation_reason || "No reason provided.",
    area:
      item.level_no === 0
        ? "Global"
        : `Level ${item.level_no}`,
    context: evidence,
    reasoning: item.recommendation_reason
      ? [item.recommendation_reason]
      : [],
    status: item.status,
    requiresApproval: item.requires_approval,
    proposedAction: item.proposed_action
  };
}

function mapActivity(item) {
  return {
    id: `${item.activity_type}-${item.entity_id}`,
    time: formatTime(item.occurred_at),
    title:
      item.activity_type === "TASK_EXECUTION"
        ? "Task execution"
        : "AI recommendation",
    category: item.status,
    description: item.message,
    source: item.activity_type
  };
}

export async function getLeafyAiData(
  token,
  onTokenRefresh
) {
  const [recommendations, activity, safety] = await Promise.all([
    apiRequest(
      "/api/ai/recommendations?limit=100",
      token,
      onTokenRefresh
    ),
    apiRequest(
      "/api/ai/activity?limit=100",
      token,
      onTokenRefresh
    ),
    apiRequest(
      "/api/safety",
      token,
      onTokenRefresh
    )
  ]);

  const mappedRecommendations = Array.isArray(
    recommendations.recommendations
  )
    ? recommendations.recommendations.map(mapRecommendation)
    : [];

  const mappedActivity = Array.isArray(activity.activity)
    ? activity.activity.map(mapActivity)
    : [];

  return {
    status: {
      aiStatus: safety.safety?.ai_enabled
        ? "Enabled"
        : "Disabled",
      lastAnalysis: mappedActivity[0]?.time || "—",
      safetyStatus: safety.safety?.emergency_stop
        ? "Emergency Stop"
        : "Normal"
    },
    recommendations: mappedRecommendations,
    activity: mappedActivity,
    feed: mappedActivity.slice(0, 10)
  };
}
