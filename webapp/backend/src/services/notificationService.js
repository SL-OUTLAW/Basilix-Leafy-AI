const {
  backendQuery
} = require("./backendDatabase");

async function getUserNotifications(userId) {
  const result = await backendQuery(
    `
    SELECT
      n.notification_id,
      n.type,
      n.title,
      n.message,
      n.severity,
      n.created_at,
      un.status,
      un.read_at
    FROM user_notifications un
    JOIN notifications n
      ON n.notification_id = un.notification_id
    WHERE un.user_id = $1
    ORDER BY n.created_at DESC;
    `,
    [userId]
  );

  return result.rows;
}

async function markNotificationAsRead(notificationId, userId) {
  const result = await backendQuery(
    `
    UPDATE user_notifications
    SET
      status = 'READ',
      read_at = COALESCE(read_at, NOW())
    WHERE notification_id = $1
      AND user_id = $2
    RETURNING
      notification_id,
      user_id,
      status,
      read_at;
    `,
    [
      notificationId,
      userId
    ]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

module.exports = {
  getUserNotifications,
  markNotificationAsRead
};