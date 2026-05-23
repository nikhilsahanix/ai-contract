import { Redis } from "ioredis";
import { env } from "./env.js";

const globalForRedis = globalThis as unknown as { redis?: Redis };
export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
