// backend\src\services\ai\index.ts

import { env } from "../../config/env.js";
import { analyzeContract as analyzeAnthropic, detectContractType as detectAnthropic } from "./anthropic.js";
import { analyzeContract as analyzeGoogle, detectContractType as detectGoogle } from "./google.js";

export interface AnalysisFlag {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  clauseRef: string;
  title: string;
  issue: string;
  marketStandard: string;
  recommendation: string;
  suggestedText: string | null;
  affectedParty: "CLIENT" | "COUNTERPARTY" | "BOTH";
}

export interface MissingClause {
  clauseType: string;
  importance: "RECOMMENDED" | "CRITICAL";
  whyItMatters: string;
  suggestedText: string;
}

export interface Positive {
  clauseRef: string;
  title: string;
  why: string;
}

export interface AnalysisOutput {
  contractType: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  favoursParty: "BALANCED" | "HEAVILY_PRO_VENDOR" | "HEAVILY_PRO_CLIENT" | "MIXED";
  executiveSummary: string;
  executiveTakeaway: string;
  flags: AnalysisFlag[];
  missingClauses: MissingClause[];
  positives: Positive[];
  negotiationPriority: string[];
  jurisdictionNotes: string[];
  // Internal tracking
  _meta: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    processingMs: number;
    chunks: number;
    extractionConfidence: number;
  };
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "AIError";
  }
}

export async function analyzeContract(params: {
  text: string;
  contractType: string;
  jurisdiction: string | null;
  extractionConfidence: number;
}): Promise<AnalysisOutput> {
  if (env.AI_PROVIDER === "google") {
    return analyzeGoogle(params);
  }
  return analyzeAnthropic(params);
}

export async function detectContractType(text: string): Promise<string> {
  if (env.AI_PROVIDER === "google") {
    return detectGoogle(text);
  }
  return detectAnthropic(text);
}
