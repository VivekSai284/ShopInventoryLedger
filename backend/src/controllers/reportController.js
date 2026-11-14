const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Stock calculation matches the existing stockLedger.js logic.
const stockExpression = {
  $switch: {
    branches: [
      {
        case: {
          $in: ["$type", ["opening", "purchase", "return"]],
        },
        then: "$quantity",
      },
      {
        case: { $eq: ["$type", "sale"] },
        then: { $multiply: ["$quantity", -1] },
      },
      {
        case: {
          $and: [
            { $eq: ["$type", "adjustment"] },
            { $eq: ["$direction", "in"] },
          ],
        },
        then: "$quantity",
      },
      {
        case: {
          $and: [
            { $eq: ["$type", "adjustment"] },
            { $eq: ["$direction", "out"] },
          ],
        },
        then: { $multiply: ["$quantity", -1] },
      },
    ],
    default: 0,
  },
};

const getStockMap = async (productIds = null) => {
  const match = productIds
    ? { product: { $in: productIds } }
    : {};

  const results = await StockMovement.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$product",
        currentStock: { $sum: stockExpression },
      },
    },
  ]);

  return new Map(
    results.map((item) => [item._id.toString(), item.currentStock])
  );
};

const getMovementFilter = (query) => {
  const filter = {};

  if (query.type) {
    filter.type = query.type;
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};

    if (query.dateFrom) {
      filter.createdAt.$gte = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      filter.createdAt.$lte = new Date(query.dateTo);
    }
  }

  return filter;
};

// GET /api/reports/summary
const getReportSummary = async (req, res) => {
  const products = await Product.find({ isArchived: false }).lean();

  const stockMap = await getStockMap(
    products.map((product) => product._id)
  );

  let totalInventoryValue = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;

  const stockByUnit = {};

  products.forEach((product) => {
    const stock = stockMap.get(product._id.toString()) || 0;

    totalInventoryValue += stock * product.sellingPrice;

    if (stock <= 0) {
      outOfStockProducts += 1;
    } else if (stock <= product.lowStockThreshold) {
      lowStockProducts += 1;
    }

    stockByUnit[product.unit] =
      (stockByUnit[product.unit] || 0) + stock;
  });

  const movementTotals = await StockMovement.aggregate([
    {
      $group: {
        _id: "$type",
        movementCount: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
      },
    },
  ]);

  const movements = {};

  movementTotals.forEach((item) => {
    movements[item._id] = {
      movementCount: item.movementCount,
      totalQuantity: item.totalQuantity,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      totalProducts: products.length,
      lowStockProducts,
      outOfStockProducts,
      healthyProducts:
        products.length - lowStockProducts - outOfStockProducts,
      stockByUnit,
      totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
      currency: "INR",
      movements,
    },
  });
};

// GET /api/reports/inventory
const getInventoryReport = async (req, res) => {
  const { page, limit, category, search } = req.validatedQuery;

  const filter = { isArchived: false };

  if (category) {
    filter.category = category;
  }

  if (search) {
    const safeSearch = escapeRegex(search);

    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { sku: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Product.countDocuments(filter),
  ]);

  const stockMap = await getStockMap(
    products.map((product) => product._id)
  );

  const inventory = products.map((product) => {
    const currentStock =
      stockMap.get(product._id.toString()) || 0;

    return {
      ...product,
      currentStock,
      inventoryValue: Number(
        (currentStock * product.sellingPrice).toFixed(2)
      ),
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      inventory,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
};

// GET /api/reports/movements
const getMovementReport = async (req, res) => {
  const { page, limit } = req.validatedQuery;

  const filter = getMovementFilter(req.validatedQuery);
  const skip = (page - 1) * limit;

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate("product", "sku name category unit")
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    StockMovement.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
};

module.exports = {
  getReportSummary,
  getInventoryReport,
  getMovementReport,
};