import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('memory://'),
  MONGODB_DB_NAME: z.string().default('nexusflow'),
  MAX_LATENESS_SECONDS: z.coerce.number().default(60),
  MAX_BATCH_SIZE: z.coerce.number().default(500),
  BACKPRESSURE_BUFFER_SIZE: z.coerce.number().default(10000),
  JWT_ACCESS_SECRET: z.string().default('dev-insecure-access-jwt-secret-replace-in-prod-min-32-chars'),
  JWT_REFRESH_SECRET: z.string().default('dev-insecure-refresh-jwt-secret-replace-in-prod-min-32-chars'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;
