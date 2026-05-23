import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Warm up on startup — prevents first-request timeout on Neon free tier
// (Neon sleeps after 5 min inactivity and takes ~2s to wake)
const MAX_RETRIES  = 5;
const RETRY_DELAY  = 3_000; // ms

async function connectWithRetry(attempt = 1): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      logger.error({ err }, `Database connection failed after ${MAX_RETRIES} attempts — giving up`);
      return; // Don't crash the server — let individual requests fail with clear errors
    }
    logger.warn(
      { attempt, nextRetryMs: RETRY_DELAY * attempt },
      `Database connection attempt ${attempt} failed — retrying`
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt)); // exponential-ish
    return connectWithRetry(attempt + 1);
  }
}

connectWithRetry();