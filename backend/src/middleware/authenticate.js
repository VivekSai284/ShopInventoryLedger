const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const asyncHandler = require("../utils/asyncHandler");

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string"
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Account is unavailable",
    });
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };

  next();
});

module.exports = authenticate;