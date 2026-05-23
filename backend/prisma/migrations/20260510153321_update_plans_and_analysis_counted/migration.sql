/*
  Warnings:

  - The values [API_WHITELABEL] on the enum `Plan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Plan_new" AS ENUM ('SOLO', 'FIRM', 'MAX', 'ENTERPRISE');
ALTER TABLE "orgs" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "orgs" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
ALTER TABLE "orgs" ALTER COLUMN "plan" SET DEFAULT 'SOLO';
COMMIT;

-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "counted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "analyses_contractId_status_idx" ON "analyses"("contractId", "status");

-- CreateIndex
CREATE INDEX "contracts_orgId_status_idx" ON "contracts"("orgId", "status");

-- CreateIndex
CREATE INDEX "contracts_orgId_createdAt_idx" ON "contracts"("orgId", "createdAt");
