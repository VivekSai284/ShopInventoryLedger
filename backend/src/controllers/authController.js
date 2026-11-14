const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");

const issueToken = (user) =>
  jwt.sign(
    { role: user.role },
    env.JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: "HS256",
    }
  );

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validatedBody;

  const existingUser = await User.exists({ email });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let user;

  try {
    user = await User.create({
      name,
      email,
      passwordHash,
      role: "staff",
    });
  } catch (error) {
    // The unique index is the final protection against concurrent
    // registration requests for the same email.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    throw error;
  }

  return res.status(201).json({
    success: true,
    message: "Staff account created successfully",
    data: {
      user: user.toSafeObject(),
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validatedBody;

  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const passwordMatches = await user.comparePassword(password);

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const token = issueToken(user);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      tokenType: "Bearer",
      expiresIn: env.JWT_EXPIRES_IN,
      user: user.toSafeObject(),
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Account is unavailable",
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      user: user.toSafeObject(),
    },
  });
});

module.exports = {
  register,
  login,
  me,
};