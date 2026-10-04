const axios = require("axios");

const { createEngineToken } = require("./engineAuth");

const engineClient = axios.create({
  baseURL: process.env.ENGINE_URL || "http://127.0.0.1:8000",
  timeout: Number(process.env.ENGINE_TIMEOUT_MS || 15000),
  validateStatus: () => true
});

function getEngineServiceHeaders() {
  return {
    Authorization: `Bearer ${createEngineToken()}`
  };
}

function getEngineHeaders(req) {
  return {
    ...getEngineServiceHeaders(),
    "X-User-ID": String(req.user.userId),
    "X-User-Role": req.user.role
  };
}

async function engineRequest({
  req,
  method,
  path,
  params,
  data,
  responseType = "json"
}) {
  return engineClient.request({
    method,
    url: path,
    params,
    data,
    responseType,
    headers: getEngineHeaders(req)
  });
}

async function engineServiceRequest({
  method,
  path,
  params,
  data,
  responseType = "json"
}) {
  return engineClient.request({
    method,
    url: path,
    params,
    data,
    responseType,
    headers: getEngineServiceHeaders()
  });
}

function engineErrorPayload(response) {
  if (!response) {
    return {
      error: "Leafy Engine is unavailable"
    };
  }

  const data = response.data;

  if (
    data &&
    typeof data === "object" &&
    !Buffer.isBuffer(data)
  ) {
    return {
      ...data,
      error: data.error || data.detail || "Engine request failed"
    };
  }

  return {
    error: "Engine request failed"
  };
}

function sendEngineResponse(res, response) {
  if (response.status >= 200 && response.status < 300) {
    return res.status(response.status).json(response.data);
  }

  return res
    .status(response.status || 502)
    .json(engineErrorPayload(response));
}

function sendEngineFailure(res, error) {
  console.error(
    "Engine request failed:",
    error.response?.data || error.message
  );

  if (error.code === "ENGINE_AUTH_NOT_CONFIGURED") {
    return res.status(500).json({
      error: error.message
    });
  }

  if (error.response) {
    return res
      .status(error.response.status || 502)
      .json(engineErrorPayload(error.response));
  }

  return res.status(502).json({
    error: "Leafy Engine is unavailable"
  });
}

module.exports = {
  engineRequest,
  engineServiceRequest,
  getEngineHeaders,
  getEngineServiceHeaders,
  sendEngineResponse,
  sendEngineFailure
};
