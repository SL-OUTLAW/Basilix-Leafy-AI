const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client();

async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error("Google authentication is not configured");
    error.code = "GOOGLE_AUTH_NOT_CONFIGURED";
    throw error;
  }

  if (!credential || typeof credential !== "string") {
    throw new Error("Google credential is required");
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google identity");
  }

  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name || null,
    picture: payload.picture || null
  };
}

module.exports = {
  verifyGoogleCredential
};