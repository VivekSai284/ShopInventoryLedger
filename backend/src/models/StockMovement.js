const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    originalSale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      required: function () {
        return this.type === "return";
      },
      default: undefined,
    },

    type: {
      type: String,
      enum: ["opening", "purchase", "sale", "return", "adjustment"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a positive whole number",
      },
    },

    // Only adjustments require an explicit direction.
    direction: {
      type: String,
      enum: ["in", "out"],
      required: function () {
        return this.type === "adjustment";
      },
    },

    reason: {
      type: String,
      required: [true, "A reason is required"],
      trim: true,
      minlength: 3,
      maxlength: 500,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional identifier to support idempotency in a later phase.
    reference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ performedBy: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ reference: 1 }, { unique: true, sparse: true });

stockMovementSchema.pre("validate", function () {
  if (this.type !== "adjustment") {
    this.direction = undefined;
  }
});

module.exports = mongoose.model("StockMovement", stockMovementSchema);
