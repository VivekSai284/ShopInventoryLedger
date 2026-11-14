const { z } = require("zod");

const commonFields = {
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(1000000),
  reason: z.string().trim().min(3).max(300),
  reference: z.string().trim().min(1).max(100).optional(),
};

const purchaseSchema = z.object(commonFields).strict();

const saleSchema = z.object(commonFields).strict();

const returnSchema = z
  .object({
    ...commonFields,
    originalSaleId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid original sale ID"),
  })
  .strict();

const adjustmentSchema = z
  .object({
    ...commonFields,
    direction: z.enum(["in", "out"]),
  })
  .strict();

const stockHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["opening", "purchase", "sale", "return", "adjustment"]).optional(),
});

module.exports = {
  purchaseSchema,
  saleSchema,
  returnSchema,
  adjustmentSchema,
  stockHistoryQuerySchema,
};