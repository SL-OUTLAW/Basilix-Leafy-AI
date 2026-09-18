const jwt = require("jsonwebtoken");

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT secret is not configured");
    error.code = "JWT_NOT_CONFIGURED";
    throw error;
  }

  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "1h"
    }
  );
}

function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT secret is not configured");
    error.code = "JWT_NOT_CONFIGURED";
    throw error;
  }

  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"]
  });
}

module.exports = {
  createToken,
  verifyToken
};
