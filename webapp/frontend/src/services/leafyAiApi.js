import { apiRequest } from "./apiClient";

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mapRecommendation(item) {
  const evidence = Array.isArray(item.evidence) ? item.evidence.map(String) : item.evidence && typeof item.evidence === "object" ? Object.entries(item.evidence).map(([key, value]) => `${key}: ${String(value)}`) : [];
  return { id:item.recommendation_id, time:formatTime(item.created_at), priority:item.risk_level ? `${item.risk_level} Risk` : "Unclassified", type:item.recommendation_type, title:item.recommendation_message || "Recommendation", summary:item.recommendation_reason || "No reason provided.", area:item.level_no === 0 ? "Global" : `Level ${item.level_no}`, context:evidence, reasoning:item.recommendation_reason ? [item.recommendation_reason] : [], status:item.status, requiresApproval:item.requires_approval, proposedAction:item.proposed_action };
}

function mapActivity(item) {
  return { id:`${item.activity_type}-${item.entity_id}`, entityId:item.entity_id, time:formatTime(item.occurred_at), title:item.activity_type === "TASK_EXECUTION" ? (item.task_name || "Task execution") : "AI recommendation", category:item.status, description:item.message, source:item.activity_type, taskAction:item.task_action, result:item.result, occurredAt:item.occurred_at };
}

export async function getLeafyAiData(token, onTokenRefresh) {
  const [recommendations, activity, safety] = await Promise.all([
    apiRequest("/api/ai/recommendations?limit=50&offset=0", token, onTokenRefresh),
    apiRequest("/api/ai/activity?limit=50&offset=0&hours=24", token, onTokenRefresh),
    apiRequest("/api/safety", token, onTokenRefresh)
  ]);
  const mappedRecommendations = Array.isArray(recommendations.recommendations) ? recommendations.recommendations.map(mapRecommendation) : [];
  const mappedActivity = Array.isArray(activity.activity) ? activity.activity.map(mapActivity) : [];
  const lastAnalysis = mappedActivity.find((item) => item.taskAction === "RUN_AI_ANALYSIS");
  return {
    status: { aiStatus:safety.safety?.ai_enabled ? "Enabled" : "Disabled", lastAnalysis:lastAnalysis?.time || "—", safetyStatus:safety.safety?.emergency_stop ? "Emergency Stop" : "Normal" },
    recommendations:mappedRecommendations,
    activity:mappedActivity,
    feed:mappedActivity.slice(0,10)
  };
}

export async function getMoreLeafyActivity(token, onTokenRefresh, offset, limit = 50) {
  const data = await apiRequest(`/api/ai/activity?limit=${limit}&offset=${offset}&hours=24`, token, onTokenRefresh);
  return Array.isArray(data.activity) ? data.activity.map(mapActivity) : [];
}

export async function getMoreLeafyRecommendations(token, onTokenRefresh, offset, limit = 50) {
  const data = await apiRequest(`/api/ai/recommendations?limit=${limit}&offset=${offset}`, token, onTokenRefresh);
  return Array.isArray(data.recommendations) ? data.recommendations.map(mapRecommendation) : [];
}
