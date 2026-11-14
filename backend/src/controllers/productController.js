
const mongoose = require("mongoose");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.validatedBody);

  return res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: { product },
  });
});

const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    includeArchived,
    page,
    limit,
  } = req.validatedQuery;

  const filter = {};

  // Archived products are visible only to owners.
  if (req.user.role === "owner" && includeArchived === "true") {
    // Owner explicitly requested both active and archived products.
  } else {
    filter.isArchived = false;
  }

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

  return res.status(200).json({
    success: true,
    data: {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).lean();

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  if (product.isArchived && req.user.role !== "owner") {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: { product },
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  if (product.isArchived) {
    return res.status(409).json({
      success: false,
      message: "Restore the product before updating it",
    });
  }

  Object.assign(product, req.validatedBody);

  await product.save();

  return res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: { product },
  });
});

const archiveProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: { isArchived: true } },
    { new: true, runValidators: true }
  );

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  if (product.isArchived !== true) {
    return res.status(500).json({
      success: false,
      message: "Unable to archive product",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Product archived successfully",
    data: { product },
  });
});

const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: { isArchived: false } },
    { new: true, runValidators: true }
  );

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Product restored successfully",
    data: { product },
  });
});

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  archiveProduct,
  restoreProduct,
};
