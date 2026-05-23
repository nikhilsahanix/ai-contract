import { prisma } from "../../config/database.js";
import { AppError } from "../../lib/errors.js";

export async function getLatestAnalysis(orgId: string, contractId: string) {
  const analysis = await prisma.analysis.findFirst({
    where: { contractId, contract: { orgId } },
    orderBy: { createdAt: "desc" }
  });
  if (!analysis) throw new AppError("NOT_FOUND", 404, "analysis not found");
  return analysis;
}
