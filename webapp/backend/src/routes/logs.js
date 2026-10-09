const express = require("express");

const { authenticate } = require("../middleware/authenticate");
const { requireRole } = require("../middleware/authorizeRole");
const {
  engineRequest,
  sendEngineResponse,
  sendEngineFailure
} = require("../services/engineClient");

const router = express.Router();

router.get(
  "/",
  authenticate,
  requireRole("OPERATOR", "ADMIN"),
  async (req, res) => {
    try {
      const response = await engineRequest({
        req,
        method: "GET",
        path: "/audit-logs",
        params: req.query
      });

      return sendEngineResponse(res, response);
    } catch (error) {
      return sendEngineFailure(res, error);
    }
  }
);

module.exports = router;
