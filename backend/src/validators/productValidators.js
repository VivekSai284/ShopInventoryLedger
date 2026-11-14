
const { z } = require("zod");

const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
    .transform((value) => value.toUpperCase()),

  name: z.string().trim().min(2).max(150),

  category: z.string().trim().min(2).max(80),

  unit: z.string().trim().min(1).max(30),

  sellingPrice: z
    .number()
    .finite()
    .min(0)
    .max(100000000),

  lowStockThreshold: z
    .number()
    .int()
    .min(0)
    .max(100000000)
    .default(5),
}).strict();

const updateProductSchema = productSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field must be provided"
  );

const productListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  includeArchived: z.enum(["true", "false"]).default("false"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).strict();

module.exports = {
  productSchema,
  updateProductSchema,
  productListQuerySchema,
};
