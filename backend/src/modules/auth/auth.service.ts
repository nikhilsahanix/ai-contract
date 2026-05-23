import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AuthError } from "../../lib/errors.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { sendVerificationEmail } from "../../services/email/resend.js";

export interface JWTPayload {
  sub: string;
  orgId: string;
  role: UserRole;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp" | "type">): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

function signRefreshToken(payload: Omit<JWTPayload, "iat" | "exp" | "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export async function register(input: {
  orgName: string;
  orgSlug: string;
  email: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({
      data: { name: input.orgName, slug: input.orgSlug }
    });
    const user = await tx.user.create({
      data: { orgId: org.id, email: input.email.toLowerCase(), passwordHash, role: UserRole.ADMIN }
    });
    return { org, user };
  });

  // Just send the email, NO TOKENS generated here anymore.
  await sendVerificationEmail(created.user.email, created.user.id).catch(() => undefined);
  
  return { user: created.user };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { org: true } });
  const isValid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  
  if (!isValid || !user) {
    throw new AuthError("AUTH_INVALID_TOKEN", "invalid credentials", 401);
  }
  
  // Prevent login if not verified
  if (!user.emailVerified) {
    throw new AuthError("FORBIDDEN", "Please verify your email address to access your account.", 403);
  }
  
  const refreshPlain = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshPlain),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  
  return {
    user,
    accessToken: signAccessToken({ sub: user.id, orgId: user.orgId, role: user.role }),
    refreshToken: refreshPlain
  };
}

export async function rotateRefreshToken(refreshToken: string) {
  const tokenHash = sha256(refreshToken);
  const found = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });
  if (!found || found.expiresAt < new Date()) {
    if (found?.userId) {
      await prisma.refreshToken.deleteMany({ where: { userId: found.userId } });
    }
    throw new AuthError("AUTH_INVALID_TOKEN", "invalid refresh token", 401);
  }
  await prisma.refreshToken.delete({ where: { id: found.id } });
  const newRefresh = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      userId: found.userId,
      tokenHash: sha256(newRefresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  return {
    accessToken: signAccessToken({
      sub: found.user.id,
      orgId: found.user.orgId,
      role: found.user.role
    }),
    refreshToken: newRefresh
  };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(refreshToken) } });
  return { success: true };
}

export async function verifyEmail(token: string) {
  // 1. Find the user AND include their organization data for the frontend
  const user = await prisma.user.findFirst({ 
    where: { id: token },
    include: { org: true } 
  });
  
  if (!user) {
    throw new AuthError("NOT_FOUND", "invalid verification token", 404);
  }

  // 2. Mark the user as verified and update login time
  const updatedUser = await prisma.user.update({ 
    where: { id: user.id }, 
    data: { emailVerified: true, lastLoginAt: new Date() },
    include: { org: true }
  });

  // 3. GENERATE TOKENS (Auto-Login)
  const refreshPlain = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshPlain),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const accessToken = signAccessToken({ 
    sub: user.id, 
    orgId: user.orgId, 
    role: user.role 
  });

  // 4. Return the user and tokens so the frontend can log them in
  return { 
    user: updatedUser,
    accessToken,
    refreshToken: refreshPlain
  };
}