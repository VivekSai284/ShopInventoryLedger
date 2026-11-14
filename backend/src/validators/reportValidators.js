const { z } = require("zod");

const movementTypes = [
  "opening",
  "purchase",
  "sale",
  "return",
  "adjustment",
];

const reportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    type: z.enum(movementTypes).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    search: z.string().trim().max(100).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (data) =>
      !data.dateFrom ||
      !data.dateTo ||
      new Date(data.dateFrom) <= new Date(data.dateTo),
    {
      message: "dateFrom must be earlier than or equal to dateTo",
      path: ["dateFrom"],
    }
  );

module.exports = { reportQuerySchema };