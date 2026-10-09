const { verifyToken } = require("../services/jwtAuth");

function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      authenticated: false,
      error: "Authentication required"
    });
  }

  const token = authorization.slice(7);

  try {
    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({
      authenticated: false,
      error: "Invalid or expired token"
    });
  }
}

module.exports = {
  authenticate
};
