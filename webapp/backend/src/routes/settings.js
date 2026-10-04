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

router.use(
  authenticate,
  requireRole("ADMIN")
);

async function proxy(req, res, method, path, useBody = false) {
  try {
    const response = await engineRequest({
      req,
      method,
      path,
      data: useBody ? req.body : undefined
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
}

router.get("/", (req, res) => {
  return proxy(req, res, "GET", "/settings");
});

router.post("/reload", (req, res) => {
  return proxy(req, res, "POST", "/settings/reload");
});

router.patch("/", requirePermission("SETTINGS_MANAGE"), (req, res) => {
  return proxy(req, res, "PATCH", "/settings/update", true);
});

router.post("/reset", requirePermission("SETTINGS_MANAGE"), (req, res) => {
  return proxy(req, res, "POST", "/settings/reset", true);
});

module.exports = router;
