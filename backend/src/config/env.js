// backend/src/config/env.js

const { z } = require("zod");
require("dotenv").config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),

  JWT_EXPIRES_IN: z.string().default("1d"),

  OWNER_NAME: z.string().trim().min(2).default("Shop Owner"),
  OWNER_EMAIL: z.string().email().transform((value) => value.toLowerCase()).optional(),
  OWNER_PASSWORD: z.string().min(12).optional(),

  STAFF_NAME: z.string().trim().min(2).default("Shop Staff"),
  STAFF_EMAIL: z.string().email().transform((value) => value.toLowerCase()).optional(),
  STAFF_PASSWORD: z.string().min(12).optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = result.data;