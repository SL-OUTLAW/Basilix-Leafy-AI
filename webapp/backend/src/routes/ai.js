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

router.get("/recommendations", async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "GET",
      path: "/ai/recommendations",
      params: req.query
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

router.get("/activity", async (req, res) => {
  try {
    const response = await engineRequest({
      req,
      method: "GET",
      path: "/ai/activity",
      params: req.query
    });

    return sendEngineResponse(res, response);
  } catch (error) {
    return sendEngineFailure(res, error);
  }
});

module.exports = router;
