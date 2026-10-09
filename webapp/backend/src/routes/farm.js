const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const { requirePermission } = require("../services/accessControl");
const { createEngineToken } = require("../services/engineAuth");
const {
  engineRequest,
  sendEngineResponse,
  sendEngineFailure
} = require("../services/engineClient");

const router = express.Router();

const userAccess = [
  authenticate,
  requireRole("OPERATOR", "ADMIN")
];

const adminAccess = [
  authenticate,
  requireRole("ADMIN")
];

function proxyJson(method, enginePath, access = userAccess) {
  return [
    ...access,
    async (req, res) => {
      try {
        const path =
          typeof enginePath === "function"
            ? enginePath(req)
            : enginePath;

        const response = await engineRequest({
          req,
          method,
          path,
          params: req.query,
          data: ["POST", "PATCH", "PUT"].includes(method)
            ? req.body
            : undefined
        });

        return sendEngineResponse(res, response);
      } catch (error) {
        return sendEngineFailure(res, error);
      }
    }
  ];
}

router.get(
  "/state",
  ...proxyJson("GET", "/farm/state")
);

router.get(
  "/sensors",
  ...proxyJson("GET", "/farm/sensors")
);

router.get(
  "/sensors/stream",
  ...userAccess,
  async (req, res) => {
    const controller = new AbortController();

    res.on("close", () => {
      controller.abort();
    });

    try {
      const engineResponse = await fetch(
        `${process.env.ENGINE_URL || "http://127.0.0.1:8000"}/farm/sensors/stream`,
        {
          headers: {
            Authorization: `Bearer ${createEngineToken()}`,
            "X-User-ID": String(req.user.userId),
            "X-User-Role": req.user.role
          },
          signal: controller.signal
        }
      );

      if (!engineResponse.ok) {
        const text = await engineResponse.text();

        return res.status(engineResponse.status).json({
          error: text || "Unable to open sensor stream"
        });
      }

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const reader = engineResponse.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          res.write(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }

      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("Sensor stream proxy failed:", error);

      if (!res.headersSent) {
        return res.status(502).json({
          error: "Unable to open sensor stream"
        });
      }

      res.end();
    }
  }
);

router.get(
  "/sensors/:sensorType/readings",
  ...proxyJson(
    "GET",
    (req) =>
      `/farm/sensors/${encodeURIComponent(req.params.sensorType)}/readings`
  )
);

router.get(
  "/sensors/:sensorType/history",
  ...proxyJson(
    "GET",
    (req) =>
      `/farm/sensors/${encodeURIComponent(req.params.sensorType)}/history`
  )
);

router.get(
  "/cameras",
  ...proxyJson("GET", "/farm/cameras")
);

router.post(
  "/cameras",
  ...proxyJson("POST", "/farm/cameras", [...adminAccess, requirePermission("SETTINGS_MANAGE")])
);

router.get(
  "/cameras/:cameraId/image",
  ...userAccess,
  async (req, res) => {
    try {
      const response = await engineRequest({
        req,
        method: "GET",
        path: `/farm/cameras/${encodeURIComponent(req.params.cameraId)}/image`,
        responseType: "stream"
      });

      if (response.status < 200 || response.status >= 300) {
        let body = "";

        if (response.data?.on) {
          for await (const chunk of response.data) {
            body += chunk.toString();
          }
        }

        return res.status(response.status || 502).json({
          error: body || "Unable to retrieve camera image"
        });
      }

      if (response.headers["content-type"]) {
        res.setHeader(
          "Content-Type",
          response.headers["content-type"]
        );
      }

      res.setHeader("Cache-Control", "no-store");
      response.data.pipe(res);
    } catch (error) {
      return sendEngineFailure(res, error);
    }
  }
);

router.get(
  "/cameras/:cameraId/analysis",
  ...proxyJson(
    "GET",
    (req) => `/farm/cameras/${encodeURIComponent(req.params.cameraId)}/analysis`
  )
);

router.get(
  "/schedule",
  ...proxyJson("GET", "/farm/schedule")
);

router.get(
  "/schedule/:scheduleId",
  ...proxyJson(
    "GET",
    (req) => `/farm/schedule/${encodeURIComponent(req.params.scheduleId)}`
  )
);

router.post(
  "/schedule",
  ...proxyJson("POST", "/farm/schedule", [...userAccess, requirePermission("SCHEDULE_MANAGE")])
);

router.patch(
  "/schedule/:scheduleId",
  ...proxyJson(
    "PATCH",
    (req) => `/farm/schedule/${encodeURIComponent(req.params.scheduleId)}`,
    [...userAccess, requirePermission("SCHEDULE_MANAGE")]
  )
);

router.post(
  "/schedule/:scheduleId/enable",
  ...proxyJson(
    "POST",
    (req) => `/farm/schedule/${encodeURIComponent(req.params.scheduleId)}/enable`,
    [...userAccess, requirePermission("SCHEDULE_MANAGE")]
  )
);

router.post(
  "/schedule/:scheduleId/disable",
  ...proxyJson(
    "POST",
    (req) => `/farm/schedule/${encodeURIComponent(req.params.scheduleId)}/disable`,
    [...userAccess, requirePermission("SCHEDULE_MANAGE")]
  )
);

router.get(
  "/controls",
  ...proxyJson("GET", "/farm/controls")
);

router.post(
  "/controls/lighting",
  ...proxyJson("POST", "/farm/controls/lighting", [...userAccess, requirePermission("MANUAL_CONTROLS")])
);

router.post(
  "/controls/irrigation",
  ...proxyJson("POST", "/farm/controls/irrigation", [...userAccess, requirePermission("MANUAL_CONTROLS")])
);

router.post(
  "/controls/fan",
  ...proxyJson("POST", "/farm/controls/fan", [...userAccess, requirePermission("MANUAL_CONTROLS")])
);

router.post(
  "/controls/ph/target",
  ...proxyJson("POST", "/farm/controls/ph/target", [...userAccess, requirePermission("DOSING_TARGETS")])
);

router.post(
  "/controls/ec/target",
  ...proxyJson("POST", "/farm/controls/ec/target", [...userAccess, requirePermission("DOSING_TARGETS")])
);

module.exports = router;
