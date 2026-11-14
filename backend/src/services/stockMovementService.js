const mongoose = require("mongoose");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { calculateStock } = require("../utils/stockLedger");

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const createMovement = async ({
  productId,
  quantity,
  type,
  direction,
  reason,
  reference,
  originalSaleId,
  userId,
}) => {
  const session = await mongoose.startSession();

  let createdMovement;
  let stockAfter;

  try {
    await session.withTransaction(async () => {
      // Find an active product and increment its internal lock version.
      // Concurrent transactions for this same product will conflict.
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          isArchived: false,
        },
        {
          $inc: { stockVersion: 1 },
        },
        {
          new: true,
          session,
        },
      );

      if (!product) {
        throw new AppError("Product not found or archived", 404);
      }

      // Calculate the balance after obtaining the product write lock.
      const currentStock = await calculateStock(product._id, session);
      // A return must be linked to a sale for this same product.
      if (type === "return") {
        const originalSale = await StockMovement.findOne({
          _id: originalSaleId,
          product: product._id,
          type: "sale",
        }).session(session);

        if (!originalSale) {
          throw new AppError("Original sale not found for this product", 400);
        }

        // Calculate how much has already been returned against this sale.
        const returnedMovements = await StockMovement.aggregate([
          {
            $match: {
              originalSale: originalSale._id,
              type: "return",
            },
          },
          {
            $group: {
              _id: null,
              totalReturned: { $sum: "$quantity" },
            },
          },
        ]).session(session);

        const alreadyReturned = returnedMovements[0]?.totalReturned || 0;
        const remainingReturnable = originalSale.quantity - alreadyReturned;

        if (quantity > remainingReturnable) {
          throw new AppError(
            `Return quantity exceeds the remaining returnable quantity. Remaining: ${remainingReturnable}`,
            409,
          );
        }
      }

      let stockChange = quantity;

      if (type === "sale" || (type === "adjustment" && direction === "out")) {
        stockChange = -quantity;
      }

      const nextStock = currentStock + stockChange;

      if (nextStock < 0) {
        throw new AppError(
          `Insufficient stock. Available: ${currentStock}, requested: ${quantity}`,
          409,
        );
      }

      const movementData = {
        product: product._id,
        type,
        quantity,
        reason,
        performedBy: userId,
      };

      if (type === "return") {
        movementData.originalSale = originalSaleId;
      }

      if (type === "adjustment") {
        movementData.direction = direction;
      }

      if (reference) {
        movementData.reference = reference;
      }

      const [movement] = await StockMovement.create([movementData], {
        session,
      });

      createdMovement = movement;
      stockAfter = nextStock;
    });

    return {
      movement: createdMovement,
      stockAfter,
    };
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("This reference has already been used", 409);
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const recordPurchase = (data) => createMovement({ ...data, type: "purchase" });

const recordSale = (data) => createMovement({ ...data, type: "sale" });

const recordReturn = (data) => createMovement({ ...data, type: "return" });

const recordAdjustment = (data) =>
  createMovement({ ...data, type: "adjustment" });

module.exports = {
  AppError,
  recordPurchase,
  recordSale,
  recordReturn,
  recordAdjustment,
};
