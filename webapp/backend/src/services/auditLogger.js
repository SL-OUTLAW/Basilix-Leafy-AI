const { engineServiceRequest } = require("./engineClient");

async function logAuditEvent(
  actionType,
  description,
  userId = null,
  metadata = null,
  entityType = null,
  entityId = null
) {
  const response = await engineServiceRequest({
    method: "POST",
    path: "/audit-logs",
    data: {
      action_type: actionType,
      description,
      user_id: userId,
      metadata,
      entity_type: entityType,
      entity_id: entityId
    }
  });

  if (response.status < 200 || response.status >= 300) {
    const detail =
      response.data?.detail ||
      response.data?.error ||
      "Engine audit request failed";

    throw new Error(detail);
  }

  return response.data?.log_id;
}

module.exports = {
  logAuditEvent
};
