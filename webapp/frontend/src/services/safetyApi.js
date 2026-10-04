import { apiRequest } from "./apiClient";

function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }); }
function relativeTime(value) { const time = new Date(value).getTime(); if (!Number.isFinite(time)) return ""; const minutes = Math.max(0, Math.floor((Date.now()-time)/60000)); if (minutes < 1) return "Now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes/60); return hours < 24 ? `${hours}h ago` : `${Math.floor(hours/24)}d ago`; }
function prettyAction(value) { return String(value || "Action").toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function mapApproval(item) { return { id:item.approval_id, type:item.action_type, command:prettyAction(item.action_type), description:item.action_data?.description || item.action_data?.task_name || "Human approval is required before this action can continue.", risk:item.risk_level ? `${item.risk_level[0]}${item.risk_level.slice(1).toLowerCase()} Risk` : "Unknown", status:item.status, time:formatTime(item.requested_at), relativeTime:relativeTime(item.requested_at), actionData:item.action_data }; }
function mapRiskConfiguration(configuration) {
  const riskItems = Object.entries(configuration?.risk || {}).map(([action, level]) => ({ id:`risk-${action}`, type:action, command:prettyAction(action), description:"Configured action risk classification.", risk:`${String(level).slice(0,1)}${String(level).slice(1).toLowerCase()} Risk`, approvalText:String(level).toUpperCase() === "HIGH" ? "Human approval required" : "Eligible for automatic handling" }));
  const thresholdItems = Object.entries(configuration?.sensor_security_thresholds || {}).map(([sensor, value]) => ({ id:`sensor-${sensor}`, type:sensor, command:`${prettyAction(sensor)} Safety Range`, description:value?.enabled ? `Range ${value.lower_limit} to ${value.upper_limit}; warning distance ${value.warning_distance}; critical distance ${value.critical_distance}.` : "Threshold monitoring disabled.", risk:value?.enabled ? "Monitored" : "Disabled", approvalText:"Current sensor safety configuration" }));
  const dosingItems = ["dosing_ph", "dosing_ec"].filter((key) => configuration?.[key]).map((key) => { const value=configuration[key]; return { id:key, type:key === "dosing_ph" ? "DOSE_PH" : "DOSE_EC", command:prettyAction(key), description:`${value.direction} dosing · ${value.dose_seconds}s dose · ${value.settle_seconds}s settle · max ${value.max_cycles} cycles.`, risk:value.enabled ? "Enabled" : "Disabled", approvalText:"Current dosing safety configuration" }; });
  return [...riskItems, ...thresholdItems, ...dosingItems];
}
function mapSafetyActivity(item) { return { id:`${item.source}-${item.entity_id}`, source:item.source, type:item.action, command:prettyAction(item.action), description:item.description, status:item.status, risk:item.risk_level, time:formatTime(item.occurred_at), relativeTime:relativeTime(item.occurred_at), occurredAt:item.occurred_at, details:item.details }; }

export async function getSafetyData(token, onTokenRefresh) {
  const [state, configuration, approvals, activity] = await Promise.all([
    apiRequest("/api/safety", token, onTokenRefresh),
    apiRequest("/api/safety/configuration", token, onTokenRefresh),
    apiRequest("/api/approvals?limit=50&offset=0", token, onTokenRefresh),
    apiRequest("/api/safety/activity?hours=24&limit=50&offset=0", token, onTokenRefresh)
  ]);
  const approvalItems = Array.isArray(approvals.approvals) ? approvals.approvals.map(mapApproval) : [];
  const activityItems = Array.isArray(activity.activity) ? activity.activity.map(mapSafetyActivity) : [];
  const pending = approvalItems.filter((item) => item.status === "PENDING");
  const blocked = activityItems.filter((item) => ["BLOCKED", "FAILED", "SKIPPED", "REJECTED"].includes(item.status)).length;
  return { state:state.safety || {}, summary:{ commands:activityItems.filter((item) => item.source === "EXECUTION").length, blocked, autoExecuted:activityItems.filter((item) => item.source === "EXECUTION" && item.status === "COMPLETED").length, pending:pending.length }, pendingApprovals:pending.slice(0,6), approvals:approvalItems, riskAssessment:mapRiskConfiguration(configuration.configuration), configuration:mapRiskConfiguration(configuration.configuration), recentActivity:activityItems.slice(0,10), safetyActivity:activityItems };
}

export function approveRequest(token,onTokenRefresh,id,reviewNote=null){ return apiRequest(`/api/approvals/${id}/approve`,token,onTokenRefresh,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({review_note:reviewNote})}); }
export function rejectRequest(token,onTokenRefresh,id,reviewNote=null){ return apiRequest(`/api/approvals/${id}/reject`,token,onTokenRefresh,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({review_note:reviewNote})}); }
export function activateEmergencyStop(token,onTokenRefresh){ return apiRequest("/api/safety/emergency-stop",token,onTokenRefresh,{method:"POST"}); }
export function clearEmergencyStop(token,onTokenRefresh){ return apiRequest("/api/safety/emergency-stop/clear",token,onTokenRefresh,{method:"POST"}); }
export function setAiEnabled(token,onTokenRefresh,enabled){ return apiRequest(enabled ? "/api/safety/ai/enable" : "/api/safety/ai/disable",token,onTokenRefresh,{method:"POST"}); }
export function getSafetyState(token,onTokenRefresh){ return apiRequest("/api/safety",token,onTokenRefresh); }

export async function getSafetyActivityPage(token, onTokenRefresh, offset, limit = 50) {
  const data = await apiRequest(`/api/safety/activity?hours=24&limit=${limit}&offset=${offset}`, token, onTokenRefresh);
  return Array.isArray(data.activity) ? data.activity.map(mapSafetyActivity) : [];
}

export async function getApprovalsPage(token, onTokenRefresh, offset, limit = 50) {
  const data = await apiRequest(`/api/approvals?limit=${limit}&offset=${offset}`, token, onTokenRefresh);
  return Array.isArray(data.approvals) ? data.approvals.map(mapApproval) : [];
}
