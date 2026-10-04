const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const {
  engineRequest,
  sendEngineResponse,
  sendEngineFailure
} = require("../services/engineClient");

const router = express.Router();

router.use(
  authenticate,
  requireRole("OPERATOR", "ADMIN")
);

router.get("/", async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "GET",
      path: "/notifications",
      params: req.query
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.get("/:notificationId", async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "GET",
      path: `/notifications/${encodeURIComponent(req.params.notificationId)}`
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.patch("/:notificationId/resolve", async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "PATCH",
      path: `/notifications/${encodeURIComponent(req.params.notificationId)}/resolve`
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

module.exports = router;
