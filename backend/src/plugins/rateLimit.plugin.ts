import fp from "fastify-plugin";
import fastifyRateLimit from "@fastify/rate-limit";
import { redis } from "../config/redis.js";

export default fp(async (app) => {
  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    redis,
    keyGenerator: (req) => req.ip
  });
});
