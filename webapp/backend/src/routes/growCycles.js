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

const userAccess = [
  authenticate,
  requireRole("OPERATOR", "ADMIN")
];

const adminAccess = [
  authenticate,
  requireRole("ADMIN")
];

async function proxy(req, res, method, path, useBody = false) {
  try {
    const response = await engineRequest({
      req,
      method,
      path,
      params: method === "GET" ? req.query : undefined,
      data: useBody ? req.body : undefined
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
}

router.get("/", ...userAccess, (req, res) => {
  return proxy(req, res, "GET", "/grow-cycles");
});

router.get("/active", ...userAccess, (req, res) => {
  return proxy(req, res, "GET", "/grow-cycles/active");
});

router.post("/", ...userAccess, requirePermission("GROW_CYCLE_MANAGE"), (req, res) => {
  return proxy(req, res, "POST", "/grow-cycles", true);
});

router.get("/:growCycleId", ...userAccess, (req, res) => {
  return proxy(
    req,
    res,
    "GET",
    `/grow-cycles/${encodeURIComponent(req.params.growCycleId)}`
  );
});

router.post("/:growCycleId/complete", ...userAccess, requirePermission("GROW_CYCLE_MANAGE"), (req, res) => {
  return proxy(
    req,
    res,
    "POST",
    `/grow-cycles/${encodeURIComponent(req.params.growCycleId)}/complete`
  );
});

router.post("/:growCycleId/cancel", ...adminAccess, (req, res) => {
  return proxy(
    req,
    res,
    "POST",
    `/grow-cycles/${encodeURIComponent(req.params.growCycleId)}/cancel`
  );
});

router.post("/:growCycleId/harvests", ...userAccess, requirePermission("HARVEST_RECORD"), (req, res) => {
  return proxy(
    req,
    res,
    "POST",
    `/grow-cycles/${encodeURIComponent(req.params.growCycleId)}/harvests`,
    true
  );
});

router.get("/:growCycleId/harvests", ...userAccess, (req, res) => {
  return proxy(
    req,
    res,
    "GET",
    `/grow-cycles/${encodeURIComponent(req.params.growCycleId)}/harvests`
  );
});

module.exports = router;
