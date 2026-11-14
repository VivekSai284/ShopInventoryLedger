const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  register,
  login,
  me,
} = require("../controllers/authController");

const authenticate = require("../middleware/authenticate");
const validateBody = require("../middleware/validateBody");

const {
  registerSchema,
  loginSchema,
} = require("../validators/authValidators");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests. Try again later.",
  },
});

router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  register
);

router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  login
);

router.get("/me", authenticate, me);

module.exports = router;