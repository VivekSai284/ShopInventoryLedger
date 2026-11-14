const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const asyncHandler = require("../utils/asyncHandler");
const validateBody = require("../middleware/validateBody");
const validateQuery = require("../middleware/validateQuery");
const validateObjectId = require("../middleware/validateObjectId");

const {
  purchaseSchema,
  saleSchema,
  returnSchema,
  adjustmentSchema,
  stockHistoryQuerySchema,
} = require("../validators/stockMovementValidators");

const {
  createPurchase,
  createSale,
  createReturn,
  createAdjustment,
  getProductStock,
  getProductStockHistory,
  getReturnableSales,
} = require("../controllers/stockMovementController");

router.use(authenticate);

// Both Owner and Staff can view stock and history.
router.get(
  "/:id/stock",
  validateObjectId,
  asyncHandler(getProductStock)
);

router.get(
  "/:id/history",
  validateObjectId,
  validateQuery(stockHistoryQuerySchema),
  asyncHandler(getProductStockHistory)
);

router.get(
  "/:id/returnable-sales",
  validateObjectId,
  asyncHandler(getReturnableSales)
);

// Only Owner can record purchases.
router.post(
  "/purchases",
  authorize("owner"),
  validateBody(purchaseSchema),
  asyncHandler(createPurchase)
);

// Owner and Staff can record sales.
router.post(
  "/sales",
  authorize("owner", "staff"),
  validateBody(saleSchema),
  asyncHandler(createSale)
);

// Owner and Staff can record saleable returns.
router.post(
  "/returns",
  authorize("owner", "staff"),
  validateBody(returnSchema),
  asyncHandler(createReturn)
);

// Only Owner can make stock adjustments.
router.post(
  "/adjustments",
  authorize("owner"),
  validateBody(adjustmentSchema),
  asyncHandler(createAdjustment)
);

module.exports = router;