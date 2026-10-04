const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const { backendQuery } = require("../services/backendDatabase");
const {
  engineRequest,
  sendEngineResponse,
  sendEngineFailure
} = require("../services/engineClient");

const router = express.Router();

router.use(authenticate, requireRole("OPERATOR", "ADMIN"));

async function readIds(userId, notificationIds) {
  if (!notificationIds.length) return new Set();
  const result = await backendQuery(
    `SELECT notification_id FROM notification_reads WHERE user_id = $1 AND notification_id = ANY($2::bigint[]);`,
    [userId, notificationIds]
  );
  return new Set(result.rows.map((row) => Number(row.notification_id)));
}

async function unreadCount(req) {
  const [countResponse, readResult] = await Promise.all([
    engineRequest({ req, method: "GET", path: "/notifications/count" }),
    backendQuery("SELECT COUNT(*)::int AS count FROM notification_reads WHERE user_id = $1;", [req.user.userId])
  ]);
  if (countResponse.status < 200 || countResponse.status >= 300) return 0;
  return Math.max(0, Number(countResponse.data.count || 0) - Number(readResult.rows[0]?.count || 0));
}

router.get("/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();

  let closed = false;
  let lastId = Number(req.query.after || 0);
  req.on("close", () => { closed = true; });

  const send = (event, data) => {
    if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("ready", { connected: true });

  while (!closed) {
    try {
      const response = await engineRequest({ req, method: "GET", path: "/notifications", params: { limit: 100, offset: 0 } });
      if (response.status >= 200 && response.status < 300) {
        const items = Array.isArray(response.data.notifications) ? response.data.notifications : [];
        const fresh = items.filter((item) => Number(item.notification_id) > lastId).sort((a, b) => Number(a.notification_id) - Number(b.notification_id));
        for (const item of fresh) {
          send("notification", { ...item, unread: true });
          lastId = Math.max(lastId, Number(item.notification_id));
        }
      }
    } catch (error) {
      send("error", { error: "Notification stream temporarily unavailable" });
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    return res.json({ unread_count: await unreadCount(req) });
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.post("/read-all", async (req, res) => {
  try {
    let offset = 0;
    const pageSize = 200;
    while (true) {
      const response = await engineRequest({ req, method: "GET", path: "/notifications", params: { limit: pageSize, offset } });
      if (response.status < 200 || response.status >= 300) return sendEngineResponse(res, response);
      const items = Array.isArray(response.data.notifications) ? response.data.notifications : [];
      if (!items.length) break;
      const ids = items.map((item) => Number(item.notification_id));
      await backendQuery(
        `INSERT INTO notification_reads (user_id, notification_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING;`,
        [req.user.userId, ids]
      );
      if (items.length < pageSize) break;
      offset += pageSize;
    }
    return res.json({ success: true, unread_count: 0 });
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.post("/:notificationId/read", async (req, res) => {
  const notificationId = Number(req.params.notificationId);
  if (!Number.isInteger(notificationId) || notificationId < 1) return res.status(400).json({ error: "Invalid notification id" });
  await backendQuery(
    `INSERT INTO notification_reads (user_id, notification_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
    [req.user.userId, notificationId]
  );
  return res.json({ success: true });
});

router.get("/", async (req, res) => {
  try {
    const response = await engineRequest({ req, method: "GET", path: "/notifications", params: req.query });
    if (response.status < 200 || response.status >= 300) return sendEngineResponse(res, response);
    const notifications = Array.isArray(response.data.notifications) ? response.data.notifications : [];
    const reads = await readIds(req.user.userId, notifications.map((item) => Number(item.notification_id)));
    return res.json({
      ...response.data,
      notifications: notifications.map((item) => ({ ...item, unread: !reads.has(Number(item.notification_id)) })),
      unread_count: await unreadCount(req)
    });
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.get("/:notificationId", async (req, res) => {
  try {
    const response = await engineRequest({ req, method: "GET", path: `/notifications/${encodeURIComponent(req.params.notificationId)}` });
    return sendEngineResponse(res, response);
  } catch (error) { return sendEngineFailure(res, error); }
});

router.patch("/:notificationId/resolve", async (req, res) => {
  try {
    const response = await engineRequest({ req, method: "PATCH", path: `/notifications/${encodeURIComponent(req.params.notificationId)}/resolve` });
    return sendEngineResponse(res, response);
  } catch (error) { return sendEngineFailure(res, error); }
});

module.exports = router;
