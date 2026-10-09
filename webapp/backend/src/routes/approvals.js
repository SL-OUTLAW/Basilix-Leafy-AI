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

router.get("/", ...readAccess, async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "GET",
      path: "/approvals",
      params: req.query
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.get("/:approvalId", ...readAccess, async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "GET",
      path: `/approvals/${encodeURIComponent(req.params.approvalId)}`
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.post("/:approvalId/approve", ...readAccess, requirePermission("APPROVAL_REVIEW"), async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "POST",
      path: `/approvals/${encodeURIComponent(req.params.approvalId)}/approve`,
      data: req.body
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.post("/:approvalId/reject", ...readAccess, requirePermission("APPROVAL_REVIEW"), async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "POST",
      path: `/approvals/${encodeURIComponent(req.params.approvalId)}/reject`,
      data: req.body
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

module.exports = router;
