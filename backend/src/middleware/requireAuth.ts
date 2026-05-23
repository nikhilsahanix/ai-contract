import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthError } from "../lib/errors.js";

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw new AuthError("AUTH_REQUIRED", "authentication required", 401);
  }
  const token = auth.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      orgId: string;
      role: "ADMIN" | "ATTORNEY" | "VIEWER";
      type: "access" | "refresh";
    };
    if (payload.type !== "access") {
      throw new AuthError("AUTH_INVALID_TOKEN", "invalid token type", 401);
    }
    req.user = { id: payload.sub, orgId: payload.orgId, role: payload.role, type: payload.type };
  } catch {
    throw new AuthError("AUTH_INVALID_TOKEN", "invalid token", 401);
  }
}
