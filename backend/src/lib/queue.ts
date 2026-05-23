// backend\src\lib\queue.ts

import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

// ── Shared job payload type (imported by worker + service) ───────────────────
export interface AnalysisJobPayload {
  contractId:   string;
  orgId:        string;
  contractType: string;
  jurisdiction: string | null;
  pageCount:    number;   // ← ADD THIS — used for dynamic lock extension
}

export const analysisQueue = new Queue<AnalysisJobPayload>("contract-analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: false,
  },
});

export const failedQueue  = new Queue("contract-analysis-failed", { connection: redis });
export const webhookQueue = new Queue("webhook-delivery",          { connection: redis });