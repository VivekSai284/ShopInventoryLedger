const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
      match: /^[A-Z0-9][A-Z0-9_-]*$/,
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: 80,
    },

    unit: {
      type: String,
      required: [true, "Unit is required"],
      trim: true,
      maxlength: 30,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Selling price must be a finite number",
      },
    },

    lowStockThreshold: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Low-stock threshold must be a whole number",
      },
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
    
    stockVersion: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

productSchema.index({ isArchived: 1, name: 1 });

module.exports = mongoose.model("Product", productSchema);
