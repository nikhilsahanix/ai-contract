-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('SOLO', 'FIRM', 'API_WHITELABEL');
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ATTORNEY', 'VIEWER');
CREATE TYPE "ContractType" AS ENUM ('NDA', 'SERVICE_AGREEMENT', 'EMPLOYMENT', 'SOFTWARE_LICENSE', 'REAL_ESTATE', 'PARTNERSHIP', 'UNKNOWN');
CREATE TYPE "ContractStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "DataRegion" AS ENUM ('US', 'EU');

CREATE TABLE "orgs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "plan" "Plan" NOT NULL DEFAULT 'SOLO',
  "stripeCustomerId" TEXT,
  "stripeSubId" TEXT,
  "analysisCount" INTEGER NOT NULL DEFAULT 0,
  "analysisLimit" INTEGER NOT NULL DEFAULT 25,
  "dataRegion" "DataRegion" NOT NULL DEFAULT 'US',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'ATTORNEY',
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecret" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "rateLimit" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contracts" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "originalName" TEXT NOT NULL,
  "contractType" "ContractType" NOT NULL DEFAULT 'UNKNOWN',
  "jurisdiction" TEXT,
  "storageKey" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "pageCount" INTEGER,
  "status" "ContractStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analyses" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
  "riskScore" DOUBLE PRECISION,
  "riskLevel" "RiskLevel",
  "flagsJson" JSONB,
  "summaryText" TEXT,
  "redlineKey" TEXT,
  "aiModel" TEXT,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "processingMs" INTEGER,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_webhooks" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT,
  "apiKeyId" TEXT,
  "action" TEXT NOT NULL,
  "resourceId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orgs_slug_key" ON "orgs"("slug");
CREATE UNIQUE INDEX "orgs_stripeCustomerId_key" ON "orgs"("stripeCustomerId");
CREATE UNIQUE INDEX "orgs_stripeSubId_key" ON "orgs"("stripeSubId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE UNIQUE INDEX "contracts_storageKey_key" ON "contracts"("storageKey");
CREATE UNIQUE INDEX "analyses_jobId_key" ON "analyses"("jobId");
CREATE INDEX "audit_logs_orgId_createdAt_idx" ON "audit_logs"("orgId", "createdAt");

ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_webhooks" ADD CONSTRAINT "org_webhooks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Run this after prisma migrate
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON contracts USING ("orgId" = current_setting('app.current_org_id'));
CREATE POLICY org_isolation ON analyses USING (
  "contractId" IN (SELECT id FROM contracts WHERE "orgId" = current_setting('app.current_org_id'))
);
