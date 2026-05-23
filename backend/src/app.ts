import Fastify from "fastify";
import multipart from "@fastify/multipart";
import rawBody from "fastify-raw-body";
import { randomUUID } from "node:crypto";
import corsPlugin from "./plugins/cors.plugin.js";
import helmetPlugin from "./plugins/helmet.plugin.js";
import rateLimitPlugin from "./plugins/rateLimit.plugin.js";
import auditPlugin from "./plugins/audit.plugin.js";
import authRoutes from "./modules/auth/auth.routes.js";
import contractsRoutes from "./modules/contracts/contracts.routes.js";
import analysisRoutes from "./modules/analysis/analysis.routes.js";
import apiKeysRoutes from "./modules/apikeys/apikeys.routes.js";
import webhooksRoutes from "./modules/webhooks/webhooks.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import { razorpayWebhookHandler } from "./modules/billing/razorpay.webhook.js";
import { prisma } from "./config/database.js";
import { redis } from "./config/redis.js";
import { analysisQueue } from "./lib/queue.js";
import { AppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { requireOrg } from "./middleware/requireOrg.js";

export function buildApp() {
  const app = Fastify({
    logger,
    disableRequestLogging: true,
    requestIdHeader: "x-request-id",
    genReqId: (req) =>
      typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"]
        : randomUUID(),
  });

  // ── Single-line colored request log ────────────────────────────────────────
  app.addHook("onResponse", (req, reply, done) => {
    const status = reply.statusCode;
    const ms     = reply.elapsedTime?.toFixed(0) ?? "?";
    const method = req.method.padEnd(7);
    const url    = req.url;

    // Skip noisy OPTIONS preflight
    if (req.method === "OPTIONS") return done();

    // Color by status code: green=2xx, yellow=3xx, red=4xx/5xx
    const colorCode = status >= 500 ? "\x1b[31m" :   // red
                      status >= 400 ? "\x1b[31m" :   // red
                      status >= 300 ? "\x1b[33m" :   // yellow
                                      "\x1b[32m";    // green
    const reset = "\x1b[0m";
    const dim   = "\x1b[90m";

    const line = `${colorCode}${method}${reset} ${url} ${colorCode}${status}${reset} ${dim}${ms}ms${reset}`;

    if (status >= 400) {
      req.log.error(line);
    } else {
      req.log.info(line);
    }

    done();
  });

  // ── rawBody MUST be registered before any body-parsing plugins ────────────
  // Required so Stripe webhook signature verification gets the raw buffer.
  app.register(rawBody, {
    field: "rawBody",   // attaches to req.rawBody
    global: false,      // only active on routes with config: { rawBody: true }
    encoding: "utf8",
    runFirst: true,     // run before other parsers
  });

  app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  app.register(corsPlugin);
  app.register(helmetPlugin);
  app.register(rateLimitPlugin);
  app.register(auditPlugin);

  app.register(async (v1) => {

    // ── Razorpay webhook — rawBody required for HMAC signature verification ──
    v1.post(
      "/billing/webhook",
      { config: { rawBody: true } },
      razorpayWebhookHandler
    );

    v1.register(authRoutes,      { prefix: "/auth"      });
    v1.register(contractsRoutes, { prefix: "/contracts" });
    v1.register(analysisRoutes,  { prefix: "/contracts" });
    v1.register(apiKeysRoutes,   { prefix: "/api-keys"  });
    v1.register(webhooksRoutes,  { prefix: "/webhooks"  });
    v1.register(billingRoutes,   { prefix: "/billing"   });

    // ── /me ──────────────────────────────────────────────────────────────────
    v1.get("/me", { preHandler: [requireAuth] }, async (req) => {
  const user = req.user;
  if (!user) return { success: false, error: { code: "AUTH_REQUIRED", message: "not authenticated" } };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, role: true },
  });

  const org = await prisma.org.findUnique({
    where: { id: user.orgId },
    select: {
      id:            true,
      name:          true,
      slug:          true,
      plan:          true,
      analysisCount: true,
      analysisLimit: true,
    },
  });

  return {
    success: true,
    data: {
      id:    dbUser?.id,
      email: dbUser?.email,
      role:  dbUser?.role,
      org,
    },
  };
});

    v1.patch("/me", { preHandler: [requireAuth] }, async (_req) => {
      // Display name is stored client-side; extend schema to persist it
      return { success: true, data: { success: true } };
    });

    // Change password
    v1.patch("/me/password", { preHandler: [requireAuth] }, async (req) => {
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
      const { AppError } = await import("./lib/errors.js");
      const bcrypt = await import("bcryptjs");
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new AppError("Current password is incorrect.", 400, "WRONG_PASSWORD");
      if (!newPassword || newPassword.length < 8) throw new AppError("New password must be at least 8 characters.", 400, "VALIDATION_ERROR");
      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
      return { success: true, data: { success: true } };
    });

    // Team members list
    v1.get("/members", { preHandler: [requireAuth, requireOrg] }, async (req) => {
      const members = await prisma.user.findMany({
        where:  { orgId: req.user!.orgId },
        select: { id: true, email: true, role: true, emailVerified: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      return { success: true, data: members };
    });

    // ── Audit logs ────────────────────────────────────────────────────────────
    v1.get("/audit-logs", { preHandler: [requireAuth, requireOrg] }, async (req) => {
      if (req.user?.role !== "ADMIN" || !req.user.orgId) {
        return { success: false, error: { code: "FORBIDDEN", message: "admin required" } };
      }
      const logs = await prisma.auditLog.findMany({
        where:   { orgId: req.user.orgId },
        orderBy: { createdAt: "desc" },
        take:    100,
      });
      return { success: true, data: logs };
    });

    // ── Health ────────────────────────────────────────────────────────────────
    v1.get("/health", async (_req, reply) => {
      const started = Date.now();
      let dbStatus:    "ok" | "error" = "ok";
      let redisStatus: "ok" | "error" = "ok";
      let queueStatus: "ok" | "error" = "ok";
      let dbLatency    = 0;
      let redisLatency = 0;
      const queueCounts = { waiting: 0, active: 0 };

      try {
        const s = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - s;
      } catch { dbStatus = "error"; }

      try {
        const s = Date.now();
        await redis.ping();
        redisLatency = Date.now() - s;
      } catch { redisStatus = "error"; }

      try {
        const counts = await analysisQueue.getJobCounts("waiting", "active");
        queueCounts.waiting = counts.waiting ?? 0;
        queueCounts.active  = counts.active  ?? 0;
      } catch { queueStatus = "error"; }

      const allOk = dbStatus === "ok" && redisStatus === "ok" && queueStatus === "ok";
      if (!allOk) reply.status(503);

      return {
        status:  allOk ? "ok" : dbStatus === "error" && redisStatus === "error" ? "down" : "degraded",
        version: "1.0.0",
        uptime:  process.uptime(),
        checks: {
          database: { status: dbStatus,    latencyMs: dbLatency    },
          redis:    { status: redisStatus,  latencyMs: redisLatency },
          queue:    { status: queueStatus,  ...queueCounts          },
        },
        latencyMs: Date.now() - started,
      };
    });

  }, { prefix: "/v1" });

  // ── Global error handler ──────────────────────────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    logger.error(error);

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if ((error as any).code === "P2002") {
      return reply.status(409).send({
        success: false,
        error: { code: "CONFLICT", message: "resource already exists" },
      });
    }
    if ((error as any).code === "P2025") {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "resource not found" },
      });
    }
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "internal server error" },
    });
  });

  return app;
}