
const express = require("express");

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const validateBody = require("../middleware/validateBody");
const validateQuery = require("../middleware/validateQuery");
const validateObjectId = require("../middleware/validateObjectId");

const {
  productSchema,
  updateProductSchema,
  productListQuerySchema,
} = require("../validators/productValidators");

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  archiveProduct,
  restoreProduct,
} = require("../controllers/productController");

const router = express.Router();

// All product endpoints require authentication.
router.use(authenticate);

// Owner and staff can view active products.
router.get(
  "/",
  validateQuery(productListQuerySchema),
  getProducts
);

router.get(
  "/:id",
  validateObjectId,
  getProductById
);

// Owner-only operations.
router.post(
  "/",
  authorize("owner"),
  validateBody(productSchema),
  createProduct
);

router.patch(
  "/:id",
  authorize("owner"),
  validateObjectId,
  validateBody(updateProductSchema),
  updateProduct
);

router.patch(
  "/:id/archive",
  authorize("owner"),
  validateObjectId,
  archiveProduct
);

router.patch(
  "/:id/restore",
  authorize("owner"),
  validateObjectId,
  restoreProduct
);

module.exports = router;
