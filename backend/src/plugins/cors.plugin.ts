import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "../config/env.js";

export default fp(async (app) => {
  const allow = [env.FRONTEND_URL, ...(env.API_WHITELIST_ORIGINS?.split(",").map((s) => s.trim()) ?? [])];
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allow.includes(origin)) cb(null, true);
      else cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
});
