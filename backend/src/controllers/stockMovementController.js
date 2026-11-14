const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { calculateStock } = require("../utils/stockLedger");

const {
  recordPurchase,
  recordSale,
  recordReturn,
  recordAdjustment,
} = require("../services/stockMovementService");

const sendMovementResponse = (res, result, message) => {
  return res.status(201).json({
    success: true,
    message,
    data: {
      movement: result.movement,
      stockAfter: result.stockAfter,
    },
  });
};

const createPurchase = async (req, res) => {
  const result = await recordPurchase({
    ...req.validatedBody,
    userId: req.user.id,
  });

  return sendMovementResponse(res, result, "Purchase recorded successfully");
};

const createSale = async (req, res) => {
  const result = await recordSale({
    ...req.validatedBody,
    userId: req.user.id,
  });

  return sendMovementResponse(res, result, "Sale recorded successfully");
};

const createReturn = async (req, res) => {
  const result = await recordReturn({
    ...req.validatedBody,
    userId: req.user.id,
  });

  return sendMovementResponse(res, result, "Return recorded successfully");
};

const createAdjustment = async (req, res) => {
  const result = await recordAdjustment({
    ...req.validatedBody,
    userId: req.user.id,
  });

  return sendMovementResponse(
    res,
    result,
    "Stock adjustment recorded successfully"
  );
};

const getProductStock = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || (product.isArchived && req.user.role !== "owner")) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const currentStock = await calculateStock(product._id);

  return res.status(200).json({
    success: true,
    data: {
      productId: product._id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      currentStock,
    },
  });
};

const getProductStockHistory = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || (product.isArchived && req.user.role !== "owner")) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const { page, limit, type } = req.validatedQuery;

  const filter = { product: product._id };

  if (type) {
    filter.type = type;
  }

  const skip = (page - 1) * limit;

  const [movements, total, currentStock] = await Promise.all([
    StockMovement.find(filter)
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    StockMovement.countDocuments(filter),

    calculateStock(product._id),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      product: {
        id: product._id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
      },
      currentStock,
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

const getReturnableSales = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || (product.isArchived && req.user.role !== "owner")) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const sales = await StockMovement.aggregate([
    {
      $match: {
        product: product._id,
        type: "sale",
      },
    },
    {
      $lookup: {
        from: StockMovement.collection.name,
        localField: "_id",
        foreignField: "originalSale",
        as: "returns",
      },
    },
    {
      $addFields: {
        returnedQuantity: {
          $sum: "$returns.quantity",
        },
      },
    },
    {
      $addFields: {
        remainingReturnable: {
          $subtract: ["$quantity", "$returnedQuantity"],
        },
      },
    },
    {
      $match: {
        remainingReturnable: { $gt: 0 },
      },
    },
    {
      $sort: {
        createdAt: -1,
        _id: -1,
      },
    },
    {
      $project: {
        _id: 1,
        quantity: 1,
        reason: 1,
        reference: 1,
        createdAt: 1,
        returnedQuantity: 1,
        remainingReturnable: 1,
      },
    },
  ]);

  return res.status(200).json({
    success: true,
    data: {
      sales,
    },
  });
};

module.exports = {
  createPurchase,
  createSale,
  createReturn,
  createAdjustment,
  getProductStock,
  getProductStockHistory,
  getReturnableSales,
};