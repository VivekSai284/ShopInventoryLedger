const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const asyncHandler = require("../utils/asyncHandler");
const validateQuery = require("../middleware/validateQuery");

const { reportQuerySchema } = require("../validators/reportValidators");

const {
  getReportSummary,
  getInventoryReport,
  getMovementReport,
} = require("../controllers/reportController");

router.use(authenticate, authorize("owner"));

router.get(
  "/summary",
  asyncHandler(getReportSummary)
);

router.get(
  "/inventory",
  validateQuery(reportQuerySchema),
  asyncHandler(getInventoryReport)
);

router.get(
  "/movements",
  validateQuery(reportQuerySchema),
  asyncHandler(getMovementReport)
);

module.exports = router;