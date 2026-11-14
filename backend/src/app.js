
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const env = require("./config/env");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const stockMovementRoutes = require("./routes/stockMovementRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

app.disable("x-powered-by");

// CORS configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://shop-inventory-ledger.onrender.com"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as Postman.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(helmet());

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Shop Inventory Ledger API is running",
  });
});

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? "API and database are healthy"
      : "Database connection unavailable",
    data: {
      api: "running",
      database: databaseConnected ? "connected" : "disconnected",
    },
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/stock", stockMovementRoutes);
app.use("/api/reports", reportRoutes);

// Error handlers must remain at the bottom.
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorHandler");

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
