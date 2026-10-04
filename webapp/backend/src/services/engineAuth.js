const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

let cachedPrivateKey = null;
let cachedPrivateKeyPath = null;

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function getPrivateKey() {
  const configuredPath = process.env.ENGINE_PRIVATE_KEY_PATH;

  if (!configuredPath) {
    const error = new Error("ENGINE_PRIVATE_KEY_PATH is not configured");
    error.code = "ENGINE_AUTH_NOT_CONFIGURED";
    throw error;
  }

  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);

  if (
    cachedPrivateKey &&
    cachedPrivateKeyPath === resolvedPath
  ) {
    return cachedPrivateKey;
  }

  cachedPrivateKey = fs.readFileSync(resolvedPath, "utf8");
  cachedPrivateKeyPath = resolvedPath;

  return cachedPrivateKey;
}

function createEngineToken() {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "EdDSA",
    typ: "JWT"
  };

  const payload = {
    sub: "webapp_backend",
    iss: "webapp_backend",
    aud: "security",
    iat: now,
    exp: now + 180,
    jti: crypto.randomUUID()
  };

  const encodedHeader = base64Url(
    JSON.stringify(header)
  );

  const encodedPayload = base64Url(
    JSON.stringify(payload)
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.sign(
    null,
    Buffer.from(signingInput),
    getPrivateKey()
  );

  return `${signingInput}.${signature.toString("base64url")}`;
}

module.exports = {
  createEngineToken
};
