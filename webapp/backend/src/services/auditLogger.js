const { query } = require("./database");

async function logAuditEvent(
  actionType,
  description,
  userId = null,
  metadata = null,
  entityType = null,
  entityId = null
) {
  await query(
    `
    INSERT INTO audit_logs (
      user_id,
      action_type,
      entity_id,
      entity_type,
      description,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb);
    `,
    [
      userId,
      actionType,
      entityId,
      entityType,
      description,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}

module.exports = {
  logAuditEvent
};
