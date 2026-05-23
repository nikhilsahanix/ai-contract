import { prisma } from './src/config/database.js';
import { AnalysisStatus, ContractStatus } from '@prisma/client';

async function main() {
  const updated = await prisma.contract.updateMany({
    where: { status: ContractStatus.PROCESSING },
    data: { status: ContractStatus.PENDING }
  });
  console.log(`Reset ${updated.count} contracts from PROCESSING to PENDING`);
  
  // Also reset any analyses stuck in PROCESSING
  const analysisUpdated = await prisma.analysis.updateMany({
    where: { status: AnalysisStatus.PROCESSING },
    data: { status: AnalysisStatus.QUEUED }
  });
  console.log(`Reset ${analysisUpdated.count} analyses from PROCESSING to QUEUED`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
