// /src/middlewares/auth.middleware.js

const jwt = require("jsonwebtoken");
const response = require("../utils/response.utils");

exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return response.error(res, "Unauthorized", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return response.error(res, "Invalid or expired token", 401);
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return response.error(res, "Forbidden", 403);
    }
    next();
  };
};
