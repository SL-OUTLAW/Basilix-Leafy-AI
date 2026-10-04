const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const { requirePermission } = require("../services/accessControl");
const {
  engineRequest,
  sendEngineResponse,
  sendEngineFailure
} = require("../services/engineClient");

const router = express.Router();

const readAccess = [
  authenticate,
  requireRole("OPERATOR", "ADMIN")
];

const adminAccess = [
  authenticate,
  requireRole("ADMIN")
];

async function proxy(req, res, method, path) {
  try {
    const response = await engineRequest({
      req,
      method,
      path,
      data: req.body
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
}

router.get("/", ...readAccess, (req, res) => {
  return proxy(req, res, "GET", "/safety/state");
});

router.get("/configuration", ...readAccess, (req, res) => {
  return proxy(req, res, "GET", "/safety/configuration");
});

router.post("/emergency-stop", ...readAccess, requirePermission("EMERGENCY_STOP"), (req, res) => {
  return proxy(req, res, "POST", "/safety/emergency-stop");
});

router.post("/emergency-stop/clear", ...readAccess, requirePermission("CLEAR_EMERGENCY_STOP"), (req, res) => {
  return proxy(req, res, "POST", "/safety/emergency-stop/clear");
});

router.post("/ai/enable", ...readAccess, requirePermission("AI_TOGGLE"), (req, res) => {
  return proxy(req, res, "POST", "/safety/ai/enable");
});

router.post("/ai/disable", ...readAccess, requirePermission("AI_TOGGLE"), (req, res) => {
  return proxy(req, res, "POST", "/safety/ai/disable");
});

module.exports = router;
