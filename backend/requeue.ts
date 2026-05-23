import { analysisQueue } from './src/workers/index.js';
import { prisma } from './src/config/database.js';

async function main() {
  const contracts = await prisma.contract.findMany({ where: { status: 'PENDING' } });
  for (const c of contracts) {
    await analysisQueue.add('analyze', {
      contractId: c.id, orgId: c.orgId,
      contractType: '',
      jurisdiction: null
    });
    console.log('Re-queued', c.id);
  }
  console.log('Done');
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
