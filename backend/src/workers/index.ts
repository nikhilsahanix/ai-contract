import { Queue } from "bullmq";
import { redis } from "../config/redis.js";
import { logger } from "../lib/logger.js";
import { analysisWorker } from "./analysis.worker.js";
import type { AnalysisJobPayload } from "../lib/queue.js";

// ─── Queue definition (shared config) ────────────────────────────────────────

export const analysisQueue = new Queue<AnalysisJobPayload>("contract-analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type:  "exponential",
      delay: 5_000,       // 5s → 10s → 20s
    },
    removeOnComplete: { age: 86_400 },  // keep completed jobs 24 hrs
    removeOnFail:     false,            // keep failed jobs indefinitely for inspection
  },
});

// Dead-letter queue — failed jobs land here after all retries
export const deadLetterQueue = new Queue<AnalysisJobPayload>(
  "contract-analysis-failed",
  { connection: redis }
);

// ─── Move exhausted jobs to DLQ ───────────────────────────────────────────────

analysisWorker.on("failed", async (job, err) => {
  if (!job) return;

  const maxAttempts = job.opts?.attempts ?? 3;
  const isExhausted = job.attemptsMade >= maxAttempts;

  if (isExhausted) {
    logger.error(
      { jobId: job.id, contractId: job.data.contractId, attempts: job.attemptsMade },
      "Job exhausted all retries — moving to dead-letter queue"
    );

    await deadLetterQueue.add(
      "dead-letter",
      {
        ...job.data,
      },
      {
        // Keep DLQ jobs for 7 days
        removeOnComplete: { age: 7 * 86_400 },
        removeOnFail:     { age: 7 * 86_400 },
      }
    );
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker gracefully");

  await analysisWorker.close();
  await analysisQueue.close();
  await deadLetterQueue.close();

  logger.info("Worker shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ─── Startup ──────────────────────────────────────────────────────────────────

logger.info(
  {
    concurrency: 3,
    queue:       "contract-analysis",
    dlq:         "contract-analysis-failed",
  },
  "Analysis worker started"
);