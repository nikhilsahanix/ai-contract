// backend\src\modules\auth\auth.routes.ts

import type { FastifyPluginAsync } from "fastify";
import {
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
  verifyEmailQuerySchema
} from "./auth.schema.js";
import * as service from "./auth.service.js";
import { prisma } from "../../config/database.js";
import { redis } from "../../config/redis.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { sendPasswordResetEmail } from "../../services/email/resend.js";
import bcrypt from "bcryptjs";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (req, reply) => {
    const body = registerBodySchema.parse(req.body);
    const data = await service.register(body);
    reply.send({ success: true, data });
  });

  app.post("/login", async (req, reply) => {
    const body = loginBodySchema.parse(req.body);
    try {
      const data = await service.login(body.email, body.password);
      await prisma.auditLog.create({
        data: {
          orgId: data.user.orgId,
          userId: data.user.id,
          action: "user.login",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] ?? null
        }
      });
      reply.send({ success: true, data });
    } catch (error) {
      const existingUser = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existingUser) {
        await prisma.auditLog
          .create({
            data: {
              orgId: existingUser.orgId,
              userId: existingUser.id,
              action: "user.login.failed",
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"] ?? null
            }
          })
          .catch(() => undefined);
      }
      throw error;
    }
  });

  app.post("/refresh", async (req, reply) => {
    const body = refreshBodySchema.parse(req.body);
    const data = await service.rotateRefreshToken(body.refreshToken);
    reply.send({ success: true, data });
  });

  app.post("/logout", async (req, reply) => {
    const body = logoutBodySchema.parse(req.body);
    const data = await service.logout(body.refreshToken);
    reply.send({ success: true, data });
  });

  app.get("/verify-email", async (req, reply) => {
    const query = verifyEmailQuerySchema.parse(req.query);
    const data = await service.verifyEmail(query.token);
    reply.send({ success: true, data });
  });

  // ── Forgot password ──────────────────────────────────────────────────────
  app.post("/forgot-password", async (req, reply) => {
    const { email } = req.body as { email?: string };
    if (!email) return reply.send({ success: true }); // always 200 to avoid enumeration

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const rawToken  = randomToken(32);
      const tokenHash = sha256(rawToken);
      // Store: key=pwreset:{hash}, value=userId, TTL=1hr
      await redis.set(`pwreset:${tokenHash}`, user.id, "EX", 3600);
      await sendPasswordResetEmail(user.email, rawToken).catch(() => undefined);
    }

    reply.send({ success: true, data: { message: "If that email is registered, a reset link has been sent." } });
  });

  // ── Reset password ───────────────────────────────────────────────────────
  app.post("/reset-password", async (req, reply) => {
    const { token, password } = req.body as { token?: string; password?: string };
    const { AppError } = await import("../../lib/errors.js");

    if (!token || !password) throw new AppError("token and password are required.", 400, "VALIDATION_ERROR");
    if (password.length < 8)  throw new AppError("Password must be at least 8 characters.", 400, "VALIDATION_ERROR");

    const tokenHash = sha256(token);
    const userId    = await redis.get(`pwreset:${tokenHash}`);

    if (!userId) throw new AppError("Reset link is invalid or has expired.", 400, "TOKEN_EXPIRED");

    const newHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    await redis.del(`pwreset:${tokenHash}`);

    reply.send({ success: true, data: { message: "Password updated successfully." } });
  });
};

export default authRoutes;
